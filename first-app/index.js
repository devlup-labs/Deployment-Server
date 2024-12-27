/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Probot} app
 */
export default (app) => {
  // Log when the app is loaded
  app.log.info("Yay, the app was loaded!");

  // Listen for the event when an issue is opened
  app.on("issues.opened", async (context) => {
    // Get the username of the user who opened the issue
    const userName = context.payload.sender.login;
    // Get the name of the repository where the issue was opened
    const repoName = context.payload.repository.name;

    // Create a message with the user's name and repository name
    const issueComment = context.issue({
      body: `Thanks for opening the issue @${userName}! You opened it in the repository: ${repoName}.`,
    });

    // Post the comment on the issue
    return context.octokit.issues.createComment(issueComment);
  });

  // For more information on building apps:
  // https://probot.github.io/docs/

  // To get your app running against GitHub, see:
  // https://probot.github.io/docs/development/
};
