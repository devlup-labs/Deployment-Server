import { exec } from 'child_process';

/**
 * This is the main entry point to your Probot app.
 * @param {import('probot').Probot} app
 */
export default (app) => {
  
  let previousRepoDetails = [];

  app.on("installation_repositories", (context) => {
    const { action, repositories_added, sender } = context.payload;
    const userName = sender?.login || "unknown user";

    if (action === "added" && repositories_added.length > 0) {
      repositories_added.forEach((repo) => {
        const repoName = repo.name;
        const visibility = repo.private ? "private" : "public";

        previousRepoDetails.push({ username: userName, repo: repoName, visibility });

        app.log.info(`User: ${userName}, Repo: ${repoName}, Visibility: ${visibility}`);
        sendToApi(userName, repoName, visibility);
      });
    }
  });

  app.on("issues.opened", (context) => {
    const terraformDirectory = "../gcp-auth";

    const terraformCommand = `terraform init && terraform apply -auto-approve`;
    exec(terraformCommand, { cwd: terraformDirectory }, (error, stdout, stderr) => {
      if (error) {
        app.log.error(`Error running Terraform: ${error.message}`);
        console.error("Verification failed. Please check the GCP project configuration.");
        return;
      }

      app.log.info(`Terraform Output: ${stdout}`);
      if (stderr) {
        app.log.warn(`Terraform Warnings: ${stderr}`);
      }

      console.log("GCP project is verified successfully!");
    });
  });

  const sendToApi = (userName, repoName, visibility) => {
    app.log.info(`Sending to API -> User: ${userName}, Repo: ${repoName}, Visibility: ${visibility}`);

    fetch('http://34.131.4.203/api/form/new', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: userName,
        repo: repoName,
        visibility: visibility,
      }),
    })
      .then((response) => {
        if (response.ok) {
          return response.json();
        } else {
          return response.text().then((text) => {
            throw new Error(text);
          });
        }
      })
      .then((data) => {
        app.log.info(`API Response: Successfully added repo "${repoName}". Response: ${JSON.stringify(data)}`);
      })
      .catch((error) => {
        app.log.error(`API Error: Failed to send data for repo "${repoName}". Error: ${error.message}`);
      });
  };
};
