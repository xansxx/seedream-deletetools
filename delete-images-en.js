// ============================================================================
// Delete Images Script - Delete generated images from Airtable in bulk
// ============================================================================
// This script allows you to delete all generated images from your Airtable base
// WARNING: This action is irreversible!

import { readFileSync, rmSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import readline from 'readline';

// Load config
const config = JSON.parse(readFileSync('./seedream-local/config.json', 'utf8'));

const AIRTABLE_BASE_ID = config.airtable.baseId;
const AIRTABLE_TOKEN = config.airtable.token;

// Create interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

// ============================================================================
// AIRTABLE FUNCTIONS
// ============================================================================

// Get all records with generated images
async function fetchRecordsWithImages() {
  const filter = 'NOT({Generated Images}=BLANK())';
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Generation?` +
              `filterByFormula=${encodeURIComponent(filter)}&` +
              `fields[]=Generated Images&fields[]=Prompt&maxRecords=1000`;

  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Airtable API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.records || [];
}

// Get all records with generated videos
async function fetchRecordsWithVideos() {
  const filter = 'NOT({Generated_Videos}=BLANK())';
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Generation?` +
              `filterByFormula=${encodeURIComponent(filter)}&` +
              `fields[]=Generated_Videos&fields[]=Prompt&maxRecords=1000`;

  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Airtable API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.records || [];
}

// Clear generated images field from a record
async function clearImagesFromRecord(recordId) {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Generation/${recordId}`;
  
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      fields: {
        'Generated Images': []
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to update record ${recordId}: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

// Clear generated videos field from a record
async function clearVideosFromRecord(recordId) {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Generation/${recordId}`;
  
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      fields: {
        'Generated_Videos': []
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to update record ${recordId}: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

// ============================================================================
// LOCAL FILES FUNCTIONS
// ============================================================================

// List all download folders
function listDownloadFolders() {
  const downloadsDir = './downloads';
  
  if (!existsSync(downloadsDir)) {
    return [];
  }

  try {
    const folders = readdirSync(downloadsDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
    return folders;
  } catch (err) {
    console.error('Error reading downloads folder:', err.message);
    return [];
  }
}

// Delete all download folders
function deleteAllDownloads() {
  const downloadsDir = './downloads';
  
  if (!existsSync(downloadsDir)) {
    console.log('downloads/ folder does not exist');
    return 0;
  }

  try {
    const folders = listDownloadFolders();
    
    for (const folder of folders) {
      const folderPath = join(downloadsDir, folder);
      rmSync(folderPath, { recursive: true, force: true });
      console.log(`  ✅ Deleted: ${folder}`);
    }
    
    return folders.length;
  } catch (err) {
    console.error('Error deleting downloads:', err.message);
    return 0;
  }
}

// ============================================================================
// MAIN MENU
// ============================================================================

async function showMenu() {
  console.log('\n========================================');
  console.log(' 🗑️  IMAGE DELETER');
  console.log('========================================\n');
  console.log('What do you want to delete?');
  console.log('');
  console.log('1. Delete IMAGES from Airtable (keep records)');
  console.log('2. Delete VIDEOS from Airtable (keep records)');
  console.log('3. Delete IMAGES and VIDEOS from Airtable');
  console.log('4. Delete locally downloaded files');
  console.log('5. Delete EVERYTHING (Airtable + local files)');
  console.log('6. Exit');
  console.log('');

  const choice = await askQuestion('Choose an option (1-6): ');
  return choice.trim();
}

// ============================================================================
// DELETE FUNCTIONS
// ============================================================================

async function deleteImagesFromAirtable() {
  console.log('\n📋 Searching for records with images in Airtable...');
  const records = await fetchRecordsWithImages();
  
  if (records.length === 0) {
    console.log('✅ No images to delete in Airtable');
    return;
  }

  let totalImages = 0;
  records.forEach(record => {
    const images = record.fields['Generated Images'] || [];
    totalImages += images.length;
  });

  console.log(`\n⚠️  WARNING: You are about to delete ${totalImages} images from ${records.length} records`);
  console.log('This action CANNOT BE UNDONE!\n');

  const confirm = await askQuestion('Are you sure? Type "YES" to confirm: ');
  
  if (confirm.toUpperCase() !== 'YES') {
    console.log('❌ Operation cancelled');
    return;
  }

  console.log('\n🗑️  Deleting images from Airtable...\n');
  
  let success = 0;
  let failed = 0;

  for (const record of records) {
    const recordId = record.id;
    const prompt = record.fields.Prompt || 'No prompt';
    const shortPrompt = prompt.substring(0, 50) + '...';
    
    try {
      await clearImagesFromRecord(recordId);
      console.log(`✅ [${recordId}] ${shortPrompt}`);
      success++;
      
      // Small pause to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (err) {
      console.error(`❌ [${recordId}] Error: ${err.message}`);
      failed++;
    }
  }

  console.log('\n========================================');
  console.log(`✅ Images deleted: ${success}`);
  console.log(`❌ Errors: ${failed}`);
  console.log('========================================');
}

async function deleteVideosFromAirtable() {
  console.log('\n📋 Searching for records with videos in Airtable...');
  const records = await fetchRecordsWithVideos();
  
  if (records.length === 0) {
    console.log('✅ No videos to delete in Airtable');
    return;
  }

  let totalVideos = 0;
  records.forEach(record => {
    const videos = record.fields['Generated_Videos'] || [];
    totalVideos += videos.length;
  });

  console.log(`\n⚠️  WARNING: You are about to delete ${totalVideos} videos from ${records.length} records`);
  console.log('This action CANNOT BE UNDONE!\n');

  const confirm = await askQuestion('Are you sure? Type "YES" to confirm: ');
  
  if (confirm.toUpperCase() !== 'YES') {
    console.log('❌ Operation cancelled');
    return;
  }

  console.log('\n🗑️  Deleting videos from Airtable...\n');
  
  let success = 0;
  let failed = 0;

  for (const record of records) {
    const recordId = record.id;
    const prompt = record.fields.Prompt || 'No prompt';
    const shortPrompt = prompt.substring(0, 50) + '...';
    
    try {
      await clearVideosFromRecord(recordId);
      console.log(`✅ [${recordId}] ${shortPrompt}`);
      success++;
      
      // Small pause to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (err) {
      console.error(`❌ [${recordId}] Error: ${err.message}`);
      failed++;
    }
  }

  console.log('\n========================================');
  console.log(`✅ Videos deleted: ${success}`);
  console.log(`❌ Errors: ${failed}`);
  console.log('========================================');
}

async function deleteLocalDownloads() {
  const folders = listDownloadFolders();
  
  if (folders.length === 0) {
    console.log('✅ No downloaded files to delete');
    return;
  }

  console.log(`\n⚠️  WARNING: You are about to delete ${folders.length} download folders`);
  console.log('Folders to delete:');
  folders.forEach(folder => console.log(`  - ${folder}`));
  console.log('\nThis action CANNOT BE UNDONE!\n');

  const confirm = await askQuestion('Are you sure? Type "YES" to confirm: ');
  
  if (confirm.toUpperCase() !== 'YES') {
    console.log('❌ Operation cancelled');
    return;
  }

  console.log('\n🗑️  Deleting local files...\n');
  const deleted = deleteAllDownloads();
  
  console.log('\n========================================');
  console.log(`✅ Folders deleted: ${deleted}`);
  console.log('========================================');
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  try {
    let running = true;
    
    while (running) {
      const choice = await showMenu();
      
      switch (choice) {
        case '1':
          await deleteImagesFromAirtable();
          break;
          
        case '2':
          await deleteVideosFromAirtable();
          break;
          
        case '3':
          await deleteImagesFromAirtable();
          await deleteVideosFromAirtable();
          break;
          
        case '4':
          await deleteLocalDownloads();
          break;
          
        case '5':
          await deleteImagesFromAirtable();
          await deleteVideosFromAirtable();
          await deleteLocalDownloads();
          break;
          
        case '6':
          console.log('\n👋 Goodbye!');
          running = false;
          break;
          
        default:
          console.log('❌ Invalid option. Choose 1-6.');
      }
      
      if (running) {
        console.log('\nPress Enter to continue...');
        await askQuestion('');
      }
    }
    
  } catch (err) {
    console.error('\n❌ ERROR:', err.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();
