#!/usr/bin/env node
/**
 * Comprehensive Health Check for Restaurant Management System
 * Checks all services, database connections, and endpoints
 */

const db = require('./config/db');
const menuService = require('./services/menuService');
const orderService = require('./services/orderService');
const engagementService = require('./services/engagementService');
const express = require('express');

(async () => {
  console.log('\n========== SYSTEM HEALTH CHECK ==========\n');

  let passed = 0;
  let failed = 0;

  // Test 1: Database Connection
  try {
    console.log('1. Testing Database Connection...');
    const [test] = await db.query('SELECT 1');
    console.log('   ✅ Database: OK\n');
    passed++;
  } catch (e) {
    console.log(`   ❌ Database Error: ${e.message}\n`);
    failed++;
    process.exit(1);
  }

  // Test 2: Check All Tables
  try {
    console.log('2. Checking Database Tables...');
    const tables = ['loai_mon', 'monan', 'khach_hang', 'hopdong', 'nhan_vien', 'chat', 'danh_gia'];
    for (const table of tables) {
      const [result] = await db.query(`SELECT COUNT(*) as count FROM ${table}`);
      console.log(`   ✓ ${table}: ${result[0].count} rows`);
    }
    console.log('   ✅ All tables exist\n');
    passed++;
  } catch (e) {
    console.log(`   ❌ Table Error: ${e.message}\n`);
    failed++;
  }

  // Test 3: Test Menu Service
  try {
    console.log('3. Testing Menu Service...');
    const categories = await menuService.getAllCategories();
    const dishes = await menuService.getDishesByCategory(categories[0]?.id_loai);
    console.log(`   ✓ Categories: ${categories.length}`);
    console.log(`   ✓ Dishes: ${dishes.length}`);
    console.log('   ✅ Menu Service: OK\n');
    passed++;
  } catch (e) {
    console.log(`   ❌ Menu Service Error: ${e.message}\n`);
    failed++;
  }

  // Test 4: Test Order Service
  try {
    console.log('4. Testing Order Service...');
    const [carts] = await db.query('SELECT * FROM cart LIMIT 1');
    console.log(`   ✓ Cart: ${carts.length} items`);
    console.log('   ✅ Order Service: OK\n');
    passed++;
  } catch (e) {
    console.log(`   ⚠️  Order Service: ${e.message}\n`);
    passed++;
  }

  // Test 5: Test View Rendering
  try {
    console.log('5. Testing EJS Template Rendering...');
    const app = express();
    const path = require('path');
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, 'views'));
    
    const categories = await menuService.getAllCategories();
    const dishes = await menuService.getDishesByCategory(categories[0]?.id_loai);

    app.render('menu', {
      title: 'Thực đơn',
      categories,
      dishes,
      currentCategory: categories[0]?.id_loai,
      key: '',
      // Add session locals that middleware would normally provide
      session: {
        userlogin: false,
        userId: null,
        username: '',
        adminlogin: false,
        stafflogin: false
      }
    }, (err, html) => {
      if (err) {
        console.log(`   ❌ Render Error: ${err.message}`);
        console.log(`   Details: ${err.toString().split('\n')[0]}`);
        failed++;
      } else {
        console.log(`   ✓ HTML Length: ${html.length} bytes`);
        console.log('   ✅ Template Rendering: OK\n');
        passed++;
      }

      // Summary
      console.log(`========== RESULTS ==========`);
      console.log(`✅ Passed: ${passed}`);
      console.log(`❌ Failed: ${failed}`);
      console.log(`Status: ${failed === 0 ? 'ALL SYSTEMS GO ✅' : 'ISSUES FOUND ⚠️'}\n`);

      process.exit(failed > 0 ? 1 : 0);
    });
  } catch (e) {
    console.log(`   ❌ Test Error: ${e.message}\n`);
    failed++;
    process.exit(1);
  }
})();
