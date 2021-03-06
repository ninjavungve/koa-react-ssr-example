const assert = require("assert");
const path = require("path");
const Koa = require("koa");
const logger = require("koa-logger");
const session = require("koa-session");
const bodyParser = require("koa-bodyparser");
const statics = require("koa-static");
const Boom = require("boom");
const isUndefined = require("lodash/isUndefined");

const setupSSR = require("./ssr");
const createRouter = require("./router");

module.exports = async function createApp() {
  const app = new Koa();

  // Add some assertions required in a production environment
  if (process.env.NODE_ENV === "production") {
    assert(process.env.SECRET_KEY, "Please set SECRET_KEY env variable.");
  }
  app.keys = [process.env.SECRET_KEY || "SECRET_KEY"];

  // Setup Next.js engine and "private" endpoint
  await setupSSR(app);

  // Add middleware
  app.use(logger());
  app.use(bodyParser());
  app.use(statics(path.join(__dirname, "..", "public")));
  app.use(session({}, app));

  // Error-handling middleware
  app.use(async (ctx, next) => {
    try {
      await next();
    } catch (err) {
      if (!Boom.isBoom(err)) {
        // This is an unhandled error. Report and log it.
        console.error("[FATAL ERROR]", err); // eslint-disable-line no-console
        err = Boom.boomify(err); // eslint-disable-line no-ex-assign
      }
      await ctx.renderBoomError(err);
    }
  });

  // Not Found middleware
  app.use(async (ctx, next) => {
    await next();
    if (isUndefined(ctx.body) && ctx.status === 404) {
      // There was no middleware who did response. So it's a 404.
      throw Boom.notFound("Not Found");
    }
  });

  // Add routes
  const router = await createRouter();
  app.use(router.routes());

  return app;
};
