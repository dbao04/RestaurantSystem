const mailer = require('./utils/mailer');
mailer.sendNewPassword('test@example.com', '12345678')
  .then(info => {
    console.log('Success!', info);
    process.exit(0);
  })
  .catch(err => {
    console.error('Test error:', err);
    process.exit(1);
  });
