const menuService = require('./services/menuService');

(async () => {
  try {
    console.log('Step 1: Getting categories...');
    const categories = await menuService.getAllCategories();
    console.log('✓ Categories:', categories.length);
    
    if (categories.length > 0) {
      console.log('Step 2: Getting dishes for category', categories[0].id_loai);
      const dishes = await menuService.getDishesByCategory(categories[0].id_loai);
      console.log('✓ Dishes:', dishes.length);
    }
    
    console.log('\n✅ MENU SERVICE WORKING');
  } catch (e) {
    console.error('❌ ERROR:', e.message);
    console.error('SQL:', e.sql);
    console.error('Full error:', e);
  }
  process.exit(0);
})();
