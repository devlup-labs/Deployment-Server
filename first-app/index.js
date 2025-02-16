import { exec } from "child_process";
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
      const configId = await fetchConfigId(username, repoName);
      if (!configId) {
        app.log.error("Could not retrieve configuration ID");
        return;
      }
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

      const credentialsString = JSON.stringify(credentials).replace(/"/g, '\\"');
      
      app.log.info("Starting GCP verification...");
      const isVerified = await verifyGcpCredentials(credentialsString, region, project_id, app);
      if (!isVerified) {
        app.log.error("GCP verification failed. VM creation aborted.");
        return;
      }

      app.log.info("Proceeding with VM creation...");
      await createVmInstance(username, repoName, region, project_id, credentialsString, ports, publicKey, app);
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
      const data = await response.json();
      
      if (!Array.isArray(data)) {
        throw new Error("Invalid port data format");
      }
  
      return data.map(portEntry => portEntry.port_no);
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
      return data.public_key ? data.public_key.trim() : ""; 
    } catch (error) {
      app.log.error(`Error fetching public key: ${error.message}`);
      return "";
    }
  };
  

  const fetchConfigId = async (username, repo) => {
    try {
      const idUrl = `${process.env.API_URL}/api/form/noauth/?username=${username}&repo=${repo}`;
      app.log.info(`Fetching Config ID from: ${idUrl}`);

      const response = await fetch(idUrl);
      const data = await response.json();
      
      if (!response.ok) throw new Error(data.message || "Failed to fetch Config ID");

      return Array.isArray(data) && data.length > 0 ? data[0].ID : null;
    } catch (error) {
      app.log.error(`Error fetching Config ID: ${error.message}`);
      return null;
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

  const createVmInstance = async (username, repoName, region, projectId, credentialsString, ports, publicKey, app) => {
    return new Promise((resolve, reject) => {
      const terraformDirectory = "../gcp-vm";
      const instanceName = `${username.toLowerCase()}-${repoName.toLowerCase()}`;
      const terraformCommand = `terraform init && terraform apply -auto-approve -var="credentials=${credentialsString}" -var="region=${region}" -var="project_id=${projectId}" -var="instance_name=${instanceName}" -var="ports=${JSON.stringify(ports)}" -var="public_key=${publicKey}" -var="zone=asia-south2-b"`;

      exec(terraformCommand, { cwd: terraformDirectory }, (error, stdout, stderr) => {
        if (error) {
          app.log.error(`VM creation failed: ${stderr || error.message}`);
          reject(error);
        } else {
          app.log.info(`VM '${instanceName}' created successfully in ${region} with ports ${ports.join(", ")}.`);
          resolve(stdout);
        }
      });
    });
  };
};
