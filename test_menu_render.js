const express = require('express');
const path = require('path');
const menuService = require('./services/menuService');

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

(async () => {
  try {
    const categories = await menuService.getAllCategories();
    const id_loai = categories.length > 0 ? categories[0].id_loai : null;
    const dishes = await menuService.getDishesByCategory(id_loai);

    console.log('Data prepared:');
    console.log('- categories:', categories.length);
    console.log('- dishes:', dishes.length);
    console.log('- firstCategory:', categories[0]);
    console.log('- firstDish:', dishes[0]);
    
    // Try rendering
    app.render('menu', {
      title: 'Thực đơn',
      categories,
      dishes,
      currentCategory: id_loai,
      key: ''
    }, (err, html) => {
      if (err) {
        console.error('❌ Render Error:', err.message);
      } else {
        console.log('✅ Render successful, HTML length:', html.length);
      }
      process.exit(0);
    });
  } catch (e) {
    console.error('❌ Error:', e.message);
    process.exit(1);
  }
})();
