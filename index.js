// Importa os pacotes necessarios
const express = require('express');
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode');
const { v4: uuidv4 } = require('uuid');

//  Importa as configuracoes do config.json
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

// Inicia o express
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

let predefinedURL = config.serverConfig.predefinedURL;
let PORT = config.serverConfig.port;

let qrCodeFolder = config.folderConfig.qrCodeFolder;
let publicFolder = config.folderConfig.publicFolder;

let qrCodeDatabaseFile = config.databaseConfig.qrCodeDatabaseFile;

let adminPage = config.pageConfig.adminPage;
let confirmationPage = config.pageConfig.confirmationPage;
let formPage = config.pageConfig.formPage;
let indexPage = config.pageConfig.indexPage;
let redirectPage = config.pageConfig.redirectPage;

let UUID;
let name;

// Checa se a database dos QRCodes existe, se não existe cria uma vazia
if (!fs.existsSync(qrCodeDatabaseFile)) {
  fs.writeFileSync(qrCodeDatabaseFile, '[]');
}

// Checa se a pasta do QRCode existe, se não cria uma vazia e dentro da pasta pública
if (!fs.existsSync(`${publicFolder}/${qrCodeFolder}`)) {
  fs.mkdirSync(`${publicFolder}/${qrCodeFolder}`, { recursive: true });
}

// Funcao para gerar o QRCode
async function generateQRCode(qrCodePath, sourceURL) {
  await qrcode.toFile(qrCodePath, sourceURL);
  return;
}

// Funcao para ler a database dos qrcodes
function readQRCodeDatabase() {
  const qrCodeDatabase = fs.readFileSync(qrCodeDatabaseFile, 'utf8');
  return JSON.parse(qrCodeDatabase);
}

// Funcao para gerar o UUID
function generateUUID() {
  return (uuidv4());
}

// Express executa no caminho "" para o index
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, publicFolder, indexPage));
});

// Express executa no caminho "/qrcodeform/" para o formulário
app.get('/qrcodeform/', (req, res) => {
  res.sendFile(path.join(__dirname, publicFolder, formPage));
});

// Express gerencia o retorno do formulário
app.post('/qrcodeform/submit', async (req, res) => {
  // Define as constantes que serão enviadas para a database dos qrcodes
  UUID = generateUUID();
  name = req.body.name;
  const sourceURL = `${predefinedURL}/redirect/${UUID}`;
  const redirectURL = req.body.redirectURL;
  const qrCodePath = `${publicFolder}/${qrCodeFolder}/${UUID}.png`;

  // Gera o QRCode
  await generateQRCode(qrCodePath, sourceURL);

  // Le a database dos qrcodes
  const qrCodeDatabase = readQRCodeDatabase();

  qrCodeDatabase.push({
    UUID,
    name,
    sourceURL,
    redirectURL,
    qrCodePath,
  });

  // Devolve a database atualizada
  fs.writeFileSync(qrCodeDatabaseFile, JSON.stringify(qrCodeDatabase, null, 2));

  // Envia a pagina de confirmação para o usuário
  res.sendFile(path.join(__dirname, publicFolder, confirmationPage));
});

// Express envia a data de UUID e Nome do qrcode para a pagina de confimação
app.get('/qrcodeform/submit/getdata', (req, res) => {
  const data = {
    UUID,
    name,
  };
  res.json(data);
});

// Express executa no caminho "/redirect/" para ouvir o UUID do usuario
app.get('/redirect/:uuid', (req, res) => {
  // Envia uma pagina de carregamento para o usuário
  res.sendFile(path.join(__dirname, publicFolder, redirectPage));

  // Recupera o UUID e le a databse
  const uuid = req.params.uuid;
  const qrCodeDatabase = readQRCodeDatabase();

  // Encontra o UUID na database
  const record = qrCodeDatabase.find(item => item.UUID === uuid);

  if (record) { 
    // Redireciona para o redirectURL correspondente ao UUID encontrado
    const redirectURL = record.redirectURL;
    res.redirect(redirectURL);
  } else {
    // Retorno se o UUID não for encontrado
    res.status(404).send('O QRCode não se encontra na database');
  }
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, publicFolder, adminPage));
});

app.get('/admin/getdata', (req, res) => {
  const data = readQRCodeDatabase(); 
  res.json(data);
});

app.post('/edit/:uuid', (req, res) => {
  const uuid = req.params.uuid;
  const newData = readQRCodeDatabase().map(entry => {
      if (entry.UUID === uuid) {
          entry.redirectURL = req.body.redirectURL;
      }
      return entry;
  });
  fs.writeFileSync(qrCodeDatabaseFile, JSON.stringify(newData, null, 2));
  res.sendStatus(200);
});

app.delete('/delete/:uuid', (req, res) => {
  const uuid = req.params.uuid;
  const newData = readQRCodeDatabase().filter(entry => entry.UUID !== uuid);
  fs.writeFileSync(qrCodeDatabaseFile, JSON.stringify(newData, null, 2));
  res.sendStatus(200);
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Internal Server Error');
});

// Aponta a pasta pública para o Express
app.use(`/${publicFolder}`, express.static(`${publicFolder}`));

// Abre e loga em qual porta o Express está rodando
app.listen(PORT, () => {
  console.log(`Server is running on ${PORT}`);
});