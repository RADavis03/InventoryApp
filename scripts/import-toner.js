#!/usr/bin/env node
'use strict';

/**
 * One-time import script: inserts all printer models and toner cartridges.
 * Safe to re-run — skips printers that already exist by name.
 * Run from the repo root: node scripts/import-toner.js
 */

const path = require('path');
// Resolve better-sqlite3 from the server's node_modules (works inside Docker at /app/server)
const Database = require(
  require.resolve('better-sqlite3', { paths: ['/app/server', __dirname + '/../server'] })
);

const DB_PATH = process.env.DB_PATH || '/app/data/inventory.db';
const db = new Database(DB_PATH);

// [model_name, is_color, { SLOT: part_number }]
// Slots: BLACK, CYAN, MAGENTA, YELLOW, WASTE_TONER, BLACK_DRUM, COLOR_DRUM, BLACK_DEVELOPER, COLOR_DEVELOPER, IMAGING_KIT
const PRINTERS = [
  ['Brother HL-2300D',               0, { BLACK: 'TN660',                BLACK_DRUM: 'DR630' }],
  ['Brother HL-L2340DW',             0, { BLACK: 'TN660',                BLACK_DRUM: 'DR630' }],
  ['Brother HLL2370dw',              0, { BLACK: 'TN760',                BLACK_DRUM: 'DR730' }],
  ['HP Color LaserJet M452dn',       1, { BLACK: 'CF410XC',  YELLOW: 'CF412XC',  MAGENTA: 'CF413XC',  CYAN: 'CF411XC' }],
  ['HP Color LaserJet E65150',       1, { BLACK: 'W9000MC',  YELLOW: 'W9002MC',  MAGENTA: 'W9003MC',  CYAN: 'W9001MC' }],
  ['HP Color LaserJet Pro MFP M479fdw', 1, { BLACK: 'W2020XC', YELLOW: 'W2022XC', MAGENTA: 'W2023XC', CYAN: 'W2021XC' }],
  ['HP LaserJet 600 M602',           0, { BLACK: 'CE390JC' }],
  ['HP LaserJet M402dw',             0, { BLACK: 'CF226JC' }],
  ['HP LaserJet M402n',              0, { BLACK: 'CF226JC' }],
  ['HP LaserJet M608',               0, { BLACK: 'CF237YC' }],
  ['HP LaserJet P2055dn',            0, { BLACK: 'CE505JC' }],
  ['HP LaserJet P3015',              0, { BLACK: 'CE255JC' }],
  ['KONICA MINOLTA BIZHUB C364',     1, { BLACK: 'A33K130', YELLOW: 'A33K230', MAGENTA: 'A33K330', CYAN: 'A33K403', WASTE_TONER: 'A4NNWY1', BLACK_DRUM: 'A2XN0RD', COLOR_DRUM: 'A2XN0TD' }],
  ['KONICA MINOLTA BIZHUB C754',     1, { BLACK: 'TN711K',  YELLOW: 'TN711Y',  MAGENTA: 'TN711M',  CYAN: 'TN711C',  WASTE_TONER: 'A0XPWY6' }],
  ['KONICA MINOLTA BIZHUB C754E',    1, { BLACK: 'TN711K',  YELLOW: 'TN711Y',  MAGENTA: 'TN711M',  CYAN: 'TN711C',  WASTE_TONER: 'A0XPWY6' }],
  ['KONICA MINOLTA BIZHUB C650i',    1, { BLACK: 'TN626K',  YELLOW: 'TN626Y',  MAGENTA: 'TN626M',  CYAN: 'TN626C',  WASTE_TONER: 'AAVA0Y1' }],
  ['Lexmark C4150',                  1, { BLACK: '24B6519', YELLOW: '24B6518', MAGENTA: '24B6517', CYAN: '24B6516', WASTE_TONER: '74C0W00', BLACK_DRUM: '74C0ZK0', COLOR_DRUM: '74C0ZV0' }],
  ['Lexmark CS748DE',                1, { BLACK: '24B5807', YELLOW: '24B5806', MAGENTA: '24B5805', CYAN: '24B5804', WASTE_TONER: 'C734X77G', BLACK_DRUM: 'C734X24G', COLOR_DRUM: 'C734X24G' }],
  ['Lexmark CX410DE',                1, { BLACK: '801HK',   YELLOW: '801HY',   MAGENTA: '801HM',   CYAN: '801HC',   WASTE_TONER: 'C540X75G', BLACK_DRUM: '70C0Z50',  COLOR_DRUM: '70C0Z50' }],
  ['Lexmark M1145',                  0, { BLACK: '24B6035', BLACK_DRUM: '24B6040' }],
  ['Lexmark M3150',                  0, { BLACK: '24B6186', BLACK_DRUM: '24B6040' }],
  ['Lexmark M5163',                  0, { BLACK: '24B6015', BLACK_DRUM: '24B6025' }],
  ['Lexmark M5170',                  0, { BLACK: '24B6015', BLACK_DRUM: '24B6025' }],
  ['Lexmark M5263',                  0, { BLACK: '24B6015', BLACK_DRUM: '24B6025' }],
  ['Lexmark XC2132',                 1, { BLACK: '24B6011', YELLOW: '24B6010', MAGENTA: '24B6009', CYAN: '24B6008', WASTE_TONER: 'C540X75G', BLACK_DRUM: '70C0Z50',  COLOR_DRUM: '70C0Z50' }],
  ['Lexmark XC6152',                 1, { BLACK: '24B6511', YELLOW: '24B6510', MAGENTA: '24B6509', CYAN: '24B6508', WASTE_TONER: '72K0W00', BLACK_DRUM: '72K0P00', COLOR_DRUM: '72K0Q00', BLACK_DEVELOPER: '72K0DK0', COLOR_DEVELOPER: '72K0DV0' }],
  ['Lexmark XC9235',                 1, { BLACK: '24B6849', YELLOW: '24B6848', MAGENTA: '24B6847', CYAN: '24B6846', WASTE_TONER: '54G0W00', BLACK_DRUM: '76C0PK0', COLOR_DRUM: '76C0PV0' }],
  ['Lexmark XM7155/XM7263',          0, { BLACK: '24B6020', BLACK_DRUM: '24B6025' }],
  ['Lexmark XC4342',                 1, { BLACK: '24B7518', YELLOW: '24B7517', MAGENTA: '24B7516', CYAN: '24B7515', WASTE_TONER: '71C0W00', BLACK_DRUM: '71C0Z10', COLOR_DRUM: '71C0Z50' }],
  ['Lexmark XC4352',                 1, { BLACK: '24B7518', YELLOW: '24B7517', MAGENTA: '24B7516', CYAN: '24B7515', WASTE_TONER: '71C0W00', BLACK_DRUM: '71C0Z10', COLOR_DRUM: '71C0Z50' }],
  ['Lexmark XC2235',                 1, { BLACK: '24B7157', YELLOW: '24B7156', MAGENTA: '24B7155', CYAN: '24B7154', WASTE_TONER: '78C0W00', BLACK_DRUM: '78C0ZK0', COLOR_DRUM: '78C0ZV0' }],
  ['Lexmark XM5365',                 0, { BLACK: '25B3074', BLACK_DRUM: '58D0Z00' }],
  ['Lexmark M1246',                  0, { BLACK: '24B6886', BLACK_DRUM: '56F0Z00' }],
  ['Lexmark C2326',                  1, { BLACK: '24B7498', YELLOW: '24B7497', MAGENTA: '24B7496', CYAN: '24B7495', WASTE_TONER: '20N0W00' }],
  ['Lexmark XC2326',                 1, { BLACK: '24B7498', YELLOW: '24B7497', MAGENTA: '24B7496', CYAN: '24B7495', WASTE_TONER: '20N0W00' }],
  ['Lexmark XM1342',                 0, { BLACK: '24B7002', BLACK_DRUM: '55B0ZA0' }],
  ['Lexmark M1342',                  0, { BLACK: '24B7002', BLACK_DRUM: '55B0ZA0' }],
  ['Lexmark XM3350',                 0, { BLACK: '24B7541', BLACK_DRUM: '66S0ZA0' }],
  ['Lexmark M3350',                  0, { BLACK: '24B7541', BLACK_DRUM: '66S0ZA0' }],
  ['Lexmark XC8355',                 1, { BLACK: '24B7577', YELLOW: '24B7604', MAGENTA: '24B7603', CYAN: '24B7602', WASTE_TONER: '77L0W00', BLACK_DRUM: '77L0Z10', COLOR_DRUM: '77L0Z50' }],
  ['Lexmark CS431dw',                1, { BLACK: '20N10K0', YELLOW: '20N10Y0', MAGENTA: '20N10M0', CYAN: '20N10C0', WASTE_TONER: '20N0W00' }],
  ['Lexmark MS321dn',                0, { BLACK: 'MS410' }],
  ['Lexmark MS521dn',                0, { BLACK: 'MS510' }],
  ['Lexmark MS610dn',                0, { BLACK: 'MS610' }],
  ['Lexmark XC9525/XC9655',          1, { BLACK: '24B7577', YELLOW: '24B7604', MAGENTA: '24B7603', CYAN: '24B7602', WASTE_TONER: '77L0W00', BLACK_DRUM: '77L0Z10', COLOR_DRUM: '77L0Z50' }],
  ['Lexmark XC2335/C2335',           1, { BLACK: '24B7540', YELLOW: '24B7539', MAGENTA: '24B7538', CYAN: '24B7537', WASTE_TONER: '75M0W00', BLACK_DRUM: '75M0ZK0', COLOR_DRUM: '75M0ZV0' }],
  ['Lexmark XM3142',                 0, { BLACK: '24B7535', BLACK_DRUM: '55B0ZA0' }],
  ['Lexmark XC9645',                 1, { BLACK: '24B7577', YELLOW: '24B7604', MAGENTA: '24B7603', CYAN: '24B7602', WASTE_TONER: '77L0W00', BLACK_DRUM: '77L0Z10', COLOR_DRUM: '77L0Z50' }],
  ['Lexmark M5255',                  0, { BLACK: '25B3074', BLACK_DRUM: '58D0Z00' }],
  ['Source Technologies ST9730',     0, { BLACK: 'STI-204065H-24B6230', BLACK_DRUM: 'STI-24B6238' }],
];

const insertPrinter  = db.prepare('INSERT INTO printers (model_name, is_color) VALUES (?, ?)');
const insertCartridge = db.prepare('INSERT INTO toner_cartridges (printer_id, slot, part_number) VALUES (?, ?, ?)');
const findPrinter    = db.prepare('SELECT id FROM printers WHERE model_name = ?');

let inserted = 0;
let skipped  = 0;
let cartridgesInserted = 0;

console.log(`\nImporting ${PRINTERS.length} printers into ${DB_PATH}\n`);

const run = db.transaction(() => {
  for (const [model_name, is_color, slots] of PRINTERS) {
    const existing = findPrinter.get(model_name);
    if (existing) {
      console.log(`  SKIP  ${model_name} (already exists)`);
      skipped++;
      continue;
    }

    const { lastInsertRowid: printer_id } = insertPrinter.run(model_name, is_color);
    console.log(`  ADD   ${model_name} (id=${printer_id}, ${is_color ? 'color' : 'B&W'})`);
    inserted++;

    for (const [slot, part_number] of Object.entries(slots)) {
      insertCartridge.run(printer_id, slot, part_number);
      console.log(`          ${slot.padEnd(20)} ${part_number}`);
      cartridgesInserted++;
    }
  }
});

run();

console.log(`\nDone. ${inserted} printers added, ${skipped} skipped, ${cartridgesInserted} cartridges inserted.\n`);
