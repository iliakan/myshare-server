const Application = require('koa');
const path = require('path');
const fs = require('fs-extra');
const app = new Application();
const Router = require('@koa/router');
const multer = require('@koa/multer');

let configPaths = ['/etc/myshare', require('os').homedir() + '/.myshare'];
const configPath = configPaths.find(p => fs.existsSync(p));

if (!configPath) {
  throw new Error("Config not found");
}

const config = require(configPath);

const publicRoot = path.resolve(__dirname, 'public');

const router = new Router();
const upload = multer({
  dest: publicRoot
});

router.post('/share', async (ctx, next) => {
  if (ctx.query.secret != config.secret) {
    ctx.throw(403);
  }
  await next();
}, upload.single('file'), ctx => {
  if (!ctx.file) {
    ctx.throw(400);
  }
  
  if (ctx.file.originalname.includes('\0')) {
    ctx.throw(400);
  }
  let originalnameSafe = ctx.file.originalname.replace(/[\/\\]/g, '-').replace(/\.{2+}/g, '-');
  let preferrablePath = path.resolve(publicRoot, originalnameSafe);

  while(fs.existsSync(preferrablePath)) {
    let id = Math.random().toString(36).slice(2,8);
    let ext = preferrablePath.match(/\.[^.]+$/);
    if (ext) {
      preferrablePath = preferrablePath.replace(/(\.[^.]+)$/, '-' + id + '$1');
    } else {
      preferrablePath += '-' + id;
    }
  }
  fs.moveSync(ctx.file.path, preferrablePath);
  console.log('ctx.request.file', ctx.request.file);
  console.log('ctx.file', ctx.file);
  console.log('ctx.request.body', ctx.request.body);
  ctx.body = new URL('/' + path.basename(preferrablePath), config.server);
});

app.use(require('koa-static')(publicRoot));
app.use(require('koa-bodyparser')());
app.use(router.routes());

app.listen(process.env.PORT || config.port || 80, process.env.HOST || config.host || '0.0.0.0');
