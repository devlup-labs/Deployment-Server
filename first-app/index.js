/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Probot} app
 */
export default (app) => {
  app.log.info("Yay, the app was loaded!");

  app.on("installation_repositories", async (context) => {
    const { action, repositories_added, repositories_removed, sender } =
      context.payload;

    const userName = sender?.login || "unknown user";

    if (action === "added" && repositories_added.length > 0) {
      repositories_added.forEach((repo) => {
        app.log.info(`Added: ${userName}, ${repo.name}`);
      });
    }

    if (action === "removed" && repositories_removed.length > 0) {
      repositories_removed.forEach((repo) => {
        app.log.info(`Removed: ${userName}, ${repo.name}`);
      });
    }
  });
};
