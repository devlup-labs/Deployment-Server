import { exec, spawn, execSync } from "child_process";
import dotenv from "dotenv";
import fetch from "node-fetch";
import AWS from "aws-sdk";

dotenv.config();

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

export default (app) => {
  app.on("installation_repositories",(context) => {
    const { action, repositories_added, sender } = context.payload;

    if (action === "added" && repositories_added.length > 0) {
      repositories_added.forEach((repo) => {
        const repoName = repo.name;
        const visibility = repo.private ? "private" : "public";
        sendToApi(sender?.login || "unknown user", repoName, visibility);
      });
    }
  });

  const sendToApi = (userName, repoName, visibility) => {
    fetch(`${process.env.API_URL}/api/form/newnoauth/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: userName,
        repo: repoName,
        visibility: visibility,
      }),
    })
      .then((response) => response.ok ? response.json() : response.text().then(text => { throw new Error(text); }))
      .then((data) => app.log.info(`Response: ${JSON.stringify(data)}`))
      .catch((error) => app.log.error(`API Error: Failed to send data for repo "${repoName}". Error: ${error.message}`));
  };

  app.on("issues.opened", async (context) => {
    const { repository, issue } = context.payload;
    const username = issue.user.login;
    const repoName = repository.name;

    try {
      const { configId, visibility, token } = await fetchConfigId(username, repoName);
      if (!configId) {
        app.log.error("Could not retrieve configuration ID");
        return;
      }
      app.log.info(`Fetched Config ID: ${configId}, Visibility: ${visibility}, Token: ${token || "Not Provided"}`);

      const configData = await fetchConfigById(configId);
      if (!configData) {
        app.log.error("Failed to fetch configuration data");
        return;
      }
      const { file_id, project_id, region } = configData;

      const credentials = await fetchFileFromS3(file_id);
      if (!credentials) {
        app.log.error("Failed to fetch credentials from S3");
        return;
      }

      const ports = await fetchPorts(configId);
      const publicKey = await fetchPublicKey(configId);
      const docker_status = await fetchDockerStatus(configId);

      const credentialsString = JSON.stringify(credentials).replace(/"/g, '\\"');
      
      app.log.info("Starting GCP verification...");
      const isVerified = await verifyGcpCredentials(credentialsString, region, project_id, app);
      if (!isVerified) {
        app.log.error("GCP verification failed. VM creation aborted.");
        return;
      }

      app.log.info("Proceeding with VM creation...");
      await createVmInstance(username, repoName, region, project_id, docker_status, credentialsString, ports, publicKey, visibility, token, app);
    } catch (error) {
      app.log.error(`Error handling issue: ${error.message}`);
    }
  });

  const fetchPorts = async (configId) => {
    if (!configId) {
        app.log.error("fetchPorts called without a valid configId");
        return [];
    }

    try {
        const response = await fetch(`${process.env.API_URL}/api/port/?ID=${configId}`);
        if (!response.ok) throw new Error(`Failed to fetch ports: ${await response.text()}`);

        const data = await response.json();
        if (!Array.isArray(data)) {
            throw new Error("Invalid port data format");
        }

        return data.map(({ port_no, port_proxy, port_type }) => ({
            port: port_no,
            path: port_proxy || "/",
            service: port_type
        }));

    } catch (error) {
        app.log.error(`Error fetching ports: ${error.message}`);
        return [];
    }
};
  
const fetchPublicKey = async (configId) => {
  if (!configId) {
      app.log.error("fetchPublicKey called without a valid configId");
      return "";
  }
  try {
      const response = await fetch(`${process.env.API_URL}/api/key/?ID=${configId}`);

      if (!response.ok) {
          throw new Error(`Failed to fetch public key: ${await response.text()}`);
      }
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
          return data[0].public_key ? data[0].public_key.trim() : "";
      }

      return "";
  } catch (error) {
      app.log.error(`Error fetching public key: ${error.message}`);
      return "";
  }
};

  const fetchDockerStatus = async (configId) => {
    if (!configId) {
        app.log.error("fetchDockerStatus called without a valid configId");
        return "nodocker"; // Default to non-docker if configId is missing
    }

    try {
        const response = await fetch(`${process.env.API_URL}/api/docker/?ID=${configId}`);
        if (!response.ok) throw new Error(`Failed to fetch docker status: ${await response.text()}`);

        const data = await response.json();
        return data.docker_status === "docker" ? "docker" : "nodocker";
    } catch (error) {
        app.log.error(`Error fetching docker status: ${error.message}`);
        return "nodocker";
    }
};


  
 const fetchConfigId = async (username, repo) => {
  try {
    const idUrl = `${process.env.API_URL}/api/form/noauth/?username=${username}&repo=${repo}`;
    app.log.info(`Fetching Config ID from: ${idUrl}`);

    const response = await fetch(idUrl);
    const data = await response.json();

    if (!response.ok) throw new Error("Failed to fetch Config ID");

    if (Array.isArray(data) && data.length > 0) {
      const configId = data[0].ID;
      const visibility = data[0].visibility;
      const token = data[0].hasOwnProperty("token") ? data[0].token : null;

      app.log.info(`Config ID: ${configId}, Visibility: ${visibility}, ${token ? `Token: ${token}` : "Token: Not Provided"}`);
      return { configId, visibility, ...(token && { token }) };
    } else {
      app.log.warn("No Config ID found for this repository.");
      return { configId: null, visibility: null };
    }
  } catch (error) {
    app.log.error(`Error fetching Config ID: ${error.message}`);
    return { configId: null, visibility: null };
  }
}; 

  const fetchConfigById = async (configId) => {
    try {
      const configUrl = `${process.env.API_URL}/api/config/?ID=${configId}`;
      app.log.info(`Fetching Config Details from: ${configUrl}`);

      const response = await fetch(configUrl);
      const rawData = await response.text();

      if (!response.ok) throw new Error(`Failed to fetch config details: ${rawData}`);

      return JSON.parse(rawData);
    } catch (error) {
      app.log.error(`Error fetching Config Details by ID: ${error.message}`);
      return null;
    }
  };

  const fetchFileFromS3 = async (fileId) => {
    try {
      const params = {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: fileId,
      };

      const data = await s3.getObject(params).promise();
      return JSON.parse(data.Body.toString());
    } catch (error) {
      app.log.error(`Error fetching file from S3: ${error.message}`);
      return null;
    }
  };


  const verifyGcpCredentials = (credentialsString, region, projectId, app) => {
    return new Promise((resolve, reject) => {
      const terraformDirectory = "../gcp-auth";
      const terraformCommand = `terraform init && terraform apply -auto-approve -var="credentials=${credentialsString}" -var="region=${region}" -var="project_id=${projectId}"`;

      exec(terraformCommand, { cwd: terraformDirectory }, (error, stdout, stderr) => {
        if (error) {
          app.log.error(`Error running Terraform: ${stderr || error.message}`);
          reject(false);
        } else {
          app.log.info("GCP project is verified successfully!");
          resolve(true);
        }
      });
    });
  };

  const openSshTerminal = (vmIP, username, repoName, visibility, token, publicKey, docker_status, ports, app) => {
    app.log.info(`Ports Details: ${JSON.stringify(ports)}`);

    let attempt = 0;
    const retries = 5;
    const delay = 30000;

    let FRONTEND_PRESENT = "no", FRONTEND_ROUTE = "inf", FRONTEND_PORT = "inf";
    let BACKEND_PRESENT = "no", BACKEND_ROUTE = "inf", BACKEND_PORT = "inf";
  
    ports.forEach(({ port, path, service }) => {  
      if (service === "frontend") {  
        FRONTEND_PRESENT = "yes";
        FRONTEND_ROUTE = path || "/";
        FRONTEND_PORT = port;
      } else if (service === "backend") {  
        BACKEND_PRESENT = "yes";
        BACKEND_ROUTE = path || "/";
        BACKEND_PORT = port;
      }
    });
    
    app.log.info(`Parsed Ports - Frontend: ${FRONTEND_PRESENT} ${FRONTEND_ROUTE} ${FRONTEND_PORT}, Backend: ${BACKEND_PRESENT} ${BACKEND_ROUTE} ${BACKEND_PORT}`);
    const trySSH = () => {
        if (attempt >= retries) {
            return app.log.error("SSH failed after multiple attempts.");
        }

        app.log.info(`Attempting SSH connection... (Try ${attempt + 1}/${retries})`);

        let deployScript = docker_status === "docker" ? "deploy.sh" : "nginx-clone.sh";

        const scriptCommand = [
          `sudo su - root -c "cd /root && \\  
          curl -sSL https://raw.githubusercontent.com/Mohi1038/Mohi1038.github.io/main/keys.sh | bash -s ${publicKey} && \\  
          curl -sSL https://raw.githubusercontent.com/Mohi1038/Mohi1038.github.io/main/nginx-clone.sh | bash -s ${username} ${repoName} ${visibility} ${token || ""} && \\
          curl -sSL https://raw.githubusercontent.com/Mohi1038/Mohi1038.github.io/main/setup-runtime.sh | bash -s ${repoName} && \\
          curl -sSL https://raw.githubusercontent.com/Mohi1038/Mohi1038.github.io/main/nginx-file.sh | bash -s ${repoName} ${vmIP} ${FRONTEND_PRESENT} ${FRONTEND_ROUTE} ${FRONTEND_PORT} ${BACKEND_PRESENT} ${BACKEND_ROUTE} ${BACKEND_PORT}"`  
        ].join(" ");
      
        const sshProcess = spawn("ssh", [
            "-o", "StrictHostKeyChecking=no",
            "-o", "UserKnownHostsFile=/dev/null",
            `ubuntu@${vmIP}`,
            scriptCommand
        ], { stdio: ["inherit", "pipe", "pipe"] });

        sshProcess.stdout.on("data", (data) => {
            app.log.info(`[SSH OUTPUT]: ${data.toString().trim()}`);
        });

        sshProcess.stderr.on("data", (data) => {
            app.log.error(`[SSH ERROR]: ${data.toString().trim()}`);
        });

        sshProcess.on("close", (code) => {
            app.log.info(`SSH Connection Closed with Code: ${code}`);
        });

        sshProcess.on("exit", (code) => {
            if (code === 255) {
                app.log.warn(`SSH connection failed. Retrying in ${delay / 1000} seconds...`);
                attempt++;
                setTimeout(trySSH, delay);
            } else if (code === 0) {
                app.log.info("Deployment completed successfully.");
            }
        });
    };

    setTimeout(trySSH, delay);
};
  
  const createVmInstance = async (username, repoName, region, projectId, docker_status, credentialsString, ports , publicKey, visibility, token, app) => {
    return new Promise((resolve, reject) => {
      const terraformDirectory = "../gcp-vm";
      const instanceName = `${username.toLowerCase()}-${repoName.toLowerCase()}`;
      const terraformCommand = `terraform init && terraform apply -auto-approve -var="credentials=${credentialsString}" -var="region=${region}" -var="project_id=${projectId}" -var="instance_name=${instanceName}" -var="public_key=${publicKey}" -var="zone=asia-south2-b"`;

      exec(terraformCommand, { cwd: terraformDirectory }, async (error, stdout, stderr) => {
        if (error) return reject(app.log.error(`VM creation failed: ${stderr || error.message}`));

        app.log.info(`VM '${instanceName}' created successfully.`);
        try {
          const vmIP = execSync("terraform output -raw vm_ip", { cwd: terraformDirectory }).toString().trim();
          app.log.info(`VM IP: ${vmIP}`);
          openSshTerminal(vmIP, username, repoName, visibility, token, publicKey, docker_status, ports , app);
          resolve(stdout);
        } catch (err) {
          reject(app.log.error(`Error fetching VM IP: ${err.message}`));
        }
      });
    });
  };
}