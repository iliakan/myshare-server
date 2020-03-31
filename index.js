const Application = require('koa');
const path = require('path');
const fs = require('fs-extra');
const app = new Application();
const Router = require('@koa/router');
const Busboy = require('busboy');

let configPaths = ['/etc/myshare', require('os').homedir() + '/.myshare'];
const configPath = configPaths.find(p => fs.existsSync(p));

if (!configPath) {
  throw new Error("Config not found");
}

const config = require(configPath);

const publicRoot = path.resolve(__dirname, 'public');

const router = new Router();

router.get('/', (ctx) => {
  ctx.body = "Hello there!";
});

router.post('/share', async (ctx, next) => {
  ctx.respond = false;

  let {req, res} = ctx;

  let busboy = new Busboy({ headers: req.headers });
  let secretOk = false;
  let fields = Object.create(null);
  busboy.on('field', function(fieldname, value) {
    if (fieldname == 'secret' && value == config.secret) secretOk = true;
    fields[fieldname] = value;
  });

  let filePath;

  busboy.on('file', function(fieldname, fileStream, filename) {
    if (!secretOk) {
      res.statusCode = 403;
      res.end("Wrong secret");
    }

    if (fieldname != 'file') return; 
    
    if (filename.includes('\0')) {
      ctx.throw(400);
    }
    let filenameSafe = filename.replace(/[\/\\]/g, '-').replace(/\.{2+}/g, '-');
    filePath = path.resolve(publicRoot, filenameSafe);
    
    while (fs.existsSync(filePath) && fields.update != 1) {
      let id = Math.random()
        .toString(36)
        .slice(2, 8);
      let ext = filePath.match(/\.[^.]+$/);
      if (ext) {
        filePath = filePath.replace(/(\.[^.]+)$/, '-' + id + '$1');
      } else {
        filePath += '-' + id;
      }
    }
    fileStream.pipe(fs.createWriteStream(filePath));
  });

  busboy.on('finish', function() {
    let body = new URL('/' + path.basename(filePath), config.server).href;
    res.statusCode = 200;
    res.end(body);
  });

  req.pipe(busboy);

});

/*

}, upload.single('file'), ctx => {
  console.log(ctx.request.body);
  if (!ctx.file) {
    ctx.throw(400);
  }
  

  fs.moveSync(ctx.file.path, filePath);
  // console.log('ctx.request.file', ctx.request.file);
  // console.log('ctx.file', ctx.file);
  // console.log('ctx.request.body', ctx.request.body);
  ctx.body = new URL('/' + path.basename(filePath), config.server).href;
});
*/

app.use(require('koa-static')(publicRoot));
app.use(require('koa-bodyparser')());
app.use(router.routes());

app.listen(process.env.PORT || config.port || 80, process.env.HOST || config.host || '0.0.0.0');
