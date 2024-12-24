/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Probot} app
 */
export default (app) => {
  app.log.info("Yay, the app was loaded!");

  app.on(
    ["pull_request.opened", "pull_request.synchronize"],
    async (context) => {
      // Extract the GitHub username and repository name
      const username = context.payload.sender.login; // Username of the event trigger
      const { owner, repo } = context.repo(); // Repository details

      // Log the details
      app.log.info(`Event triggered by user: ${username}`);
      app.log.info(`Repository: ${owner}/${repo}`);

      // Deployment creation
      const res = await context.octokit.repos.createDeployment(
        context.repo({
          ref: context.payload.pull_request.head.ref, // The branch or ref being deployed
          task: "deploy",
          auto_merge: true,
          required_contexts: [],
          payload: {
            schema: "rocks!",
          },
          environment: "production",
          description: `Deployment initiated by ${username} on ${owner}/${repo}`, // Updated description
          transient_environment: false,
          production_environment: true,
        })
      );

      // Extract deployment ID
      const deploymentId = res.data.id;

      // Set deployment status
      await context.octokit.repos.createDeploymentStatus(
        context.repo({
          deployment_id: deploymentId,
          state: "success",
          log_url: "https://example.com",
          description: `Deployment by ${username} on ${owner}/${repo} succeeded!`, // Updated status description
          environment_url: "https://example.com",
          auto_inactive: true,
        })
      );

      app.log.info(
        `Deployment created and status updated for user: ${username} on repo: ${owner}/${repo}`
      );
    }
  );

  // For more information on building apps:
  // https://probot.github.io/docs/

  // To get your app running against GitHub, see:
  // https://probot.github.io/docs/development/
};
