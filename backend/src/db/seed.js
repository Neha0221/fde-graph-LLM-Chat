const fs = require("fs");
const path = require("path");
const db = require("../config/db");

const DATA_DIR = path.resolve(__dirname, "../../data/raw/sap-o2c-data");

// Read all JSONL files in a folder and return array of parsed objects
const readJsonl = (folderName) => {
  const folderPath = path.join(DATA_DIR, folderName);
  if (!fs.existsSync(folderPath)) {
    console.warn(`[SEED] Folder not found: ${folderPath}`);
    return [];
  }
  const files = fs.readdirSync(folderPath).filter((f) => f.endsWith(".jsonl"));
  const records = [];
  for (const file of files) {
    const lines = fs.readFileSync(path.join(folderPath, file), "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) {
        try {
          records.push(JSON.parse(trimmed));
        } catch {
          // skip malformed lines
        }
      }
    }
  }
  return records;
};

const toInt = (val) => (val ? 1 : 0);
const toFloat = (val) => (val !== undefined && val !== null && val !== "" ? parseFloat(val) : null);
const toStr = (val) => (val !== undefined && val !== null ? String(val) : null);

// ---- SEED FUNCTIONS ----

const seedBusinessPartners = () => {
  const records = readJsonl("business_partners");
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO business_partners
      (business_partner, customer, full_name, name, partner_category, creation_date, last_change_date, is_blocked, is_archived)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertAll = db.transaction((rows) => {
    for (const r of rows) {
      stmt.run(
        toStr(r.businessPartner),
        toStr(r.customer),
        toStr(r.businessPartnerFullName),
        toStr(r.businessPartnerName),
        toStr(r.businessPartnerCategory),
        toStr(r.creationDate),
        toStr(r.lastChangeDate),
        toInt(r.businessPartnerIsBlocked),
        toInt(r.isMarkedForArchiving)
      );
    }
  });
  insertAll(records);
  console.log(`[SEED] business_partners: ${records.length} rows`);
};

const seedBusinessPartnerAddresses = () => {
  const records = readJsonl("business_partner_addresses");
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO business_partner_addresses
      (business_partner, address_id, city_name, country, postal_code, region, street_name, address_time_zone)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertAll = db.transaction((rows) => {
    for (const r of rows) {
      stmt.run(
        toStr(r.businessPartner),
        toStr(r.addressId),
        toStr(r.cityName),
        toStr(r.country),
        toStr(r.postalCode),
        toStr(r.region),
        toStr(r.streetName),
        toStr(r.addressTimeZone)
      );
    }
  });
  insertAll(records);
  console.log(`[SEED] business_partner_addresses: ${records.length} rows`);
};

const seedCustomerCompanyAssignments = () => {
  const records = readJsonl("customer_company_assignments");
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO customer_company_assignments
      (customer, company_code, payment_terms, reconciliation_account, deletion_indicator)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertAll = db.transaction((rows) => {
    for (const r of rows) {
      stmt.run(
        toStr(r.customer),
        toStr(r.companyCode),
        toStr(r.paymentTerms),
        toStr(r.reconciliationAccount),
        toInt(r.deletionIndicator)
      );
    }
  });
  insertAll(records);
  console.log(`[SEED] customer_company_assignments: ${records.length} rows`);
};

const seedCustomerSalesAreaAssignments = () => {
  const records = readJsonl("customer_sales_area_assignments");
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO customer_sales_area_assignments
      (customer, sales_organization, distribution_channel, division)
    VALUES (?, ?, ?, ?)
  `);
  const insertAll = db.transaction((rows) => {
    for (const r of rows) {
      stmt.run(
        toStr(r.customer),
        toStr(r.salesOrganization),
        toStr(r.distributionChannel),
        toStr(r.division)
      );
    }
  });
  insertAll(records);
  console.log(`[SEED] customer_sales_area_assignments: ${records.length} rows`);
};

const seedProducts = () => {
  const records = readJsonl("products");
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO products
      (product, product_type, product_old_id, gross_weight, net_weight, weight_unit, base_unit, product_group, division, industry_sector, creation_date, last_change_date, is_marked_for_deletion)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertAll = db.transaction((rows) => {
    for (const r of rows) {
      stmt.run(
        toStr(r.product),
        toStr(r.productType),
        toStr(r.productOldId),
        toFloat(r.grossWeight),
        toFloat(r.netWeight),
        toStr(r.weightUnit),
        toStr(r.baseUnit),
        toStr(r.productGroup),
        toStr(r.division),
        toStr(r.industrySector),
        toStr(r.creationDate),
        toStr(r.lastChangeDate),
        toInt(r.isMarkedForDeletion)
      );
    }
  });
  insertAll(records);
  console.log(`[SEED] products: ${records.length} rows`);
};

const seedProductDescriptions = () => {
  const records = readJsonl("product_descriptions");
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO product_descriptions (product, language, product_description)
    VALUES (?, ?, ?)
  `);
  const insertAll = db.transaction((rows) => {
    for (const r of rows) {
      stmt.run(toStr(r.product), toStr(r.language), toStr(r.productDescription));
    }
  });
  insertAll(records);
  console.log(`[SEED] product_descriptions: ${records.length} rows`);
};

const seedPlants = () => {
  const records = readJsonl("plants");
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO plants
      (plant, plant_name, sales_organization, distribution_channel, division, address_id, factory_calendar)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertAll = db.transaction((rows) => {
    for (const r of rows) {
      stmt.run(
        toStr(r.plant),
        toStr(r.plantName),
        toStr(r.salesOrganization),
        toStr(r.distributionChannel),
        toStr(r.division),
        toStr(r.addressId),
        toStr(r.factoryCalendar)
      );
    }
  });
  insertAll(records);
  console.log(`[SEED] plants: ${records.length} rows`);
};

const seedProductPlants = () => {
  const records = readJsonl("product_plants");
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO product_plants (product, plant)
    VALUES (?, ?)
  `);
  const insertAll = db.transaction((rows) => {
    for (const r of rows) {
      stmt.run(toStr(r.product), toStr(r.plant));
    }
  });
  insertAll(records);
  console.log(`[SEED] product_plants: ${records.length} rows`);
};

const seedProductStorageLocations = () => {
  const records = readJsonl("product_storage_locations");
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO product_storage_locations (product, plant, storage_location)
    VALUES (?, ?, ?)
  `);
  const insertAll = db.transaction((rows) => {
    for (const r of rows) {
      stmt.run(toStr(r.product), toStr(r.plant), toStr(r.storageLocation));
    }
  });
  insertAll(records);
  console.log(`[SEED] product_storage_locations: ${records.length} rows`);
};

const seedSalesOrderHeaders = () => {
  const records = readJsonl("sales_order_headers");
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO sales_order_headers
      (sales_order, sales_order_type, sales_organization, distribution_channel, sold_to_party,
       creation_date, total_net_amount, transaction_currency, overall_delivery_status,
       overall_billing_status, pricing_date, requested_delivery_date, header_billing_block,
       delivery_block_reason, customer_payment_terms)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertAll = db.transaction((rows) => {
    for (const r of rows) {
      stmt.run(
        toStr(r.salesOrder),
        toStr(r.salesOrderType),
        toStr(r.salesOrganization),
        toStr(r.distributionChannel),
        toStr(r.soldToParty),
        toStr(r.creationDate),
        toFloat(r.totalNetAmount),
        toStr(r.transactionCurrency),
        toStr(r.overallDeliveryStatus),
        toStr(r.overallOrdReltdBillgStatus),
        toStr(r.pricingDate),
        toStr(r.requestedDeliveryDate),
        toStr(r.headerBillingBlockReason),
        toStr(r.deliveryBlockReason),
        toStr(r.customerPaymentTerms)
      );
    }
  });
  insertAll(records);
  console.log(`[SEED] sales_order_headers: ${records.length} rows`);
};

const seedSalesOrderItems = () => {
  const records = readJsonl("sales_order_items");
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO sales_order_items
      (sales_order, sales_order_item, material, requested_quantity, quantity_unit,
       net_amount, transaction_currency, material_group, production_plant, storage_location)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertAll = db.transaction((rows) => {
    for (const r of rows) {
      stmt.run(
        toStr(r.salesOrder),
        toStr(r.salesOrderItem),
        toStr(r.material),
        toFloat(r.requestedQuantity),
        toStr(r.requestedQuantityUnit),
        toFloat(r.netAmount),
        toStr(r.transactionCurrency),
        toStr(r.materialGroup),
        toStr(r.productionPlant),
        toStr(r.storageLocation)
      );
    }
  });
  insertAll(records);
  console.log(`[SEED] sales_order_items: ${records.length} rows`);
};

const seedSalesOrderScheduleLines = () => {
  const records = readJsonl("sales_order_schedule_lines");
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO sales_order_schedule_lines
      (sales_order, sales_order_item, schedule_line, confirmed_delivery_date, order_quantity_unit, confirmed_quantity)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertAll = db.transaction((rows) => {
    for (const r of rows) {
      stmt.run(
        toStr(r.salesOrder),
        toStr(r.salesOrderItem),
        toStr(r.scheduleLine),
        toStr(r.confirmedDeliveryDate),
        toStr(r.orderQuantityUnit),
        toFloat(r.confdOrderQtyByMatlAvailCheck)
      );
    }
  });
  insertAll(records);
  console.log(`[SEED] sales_order_schedule_lines: ${records.length} rows`);
};

const seedOutboundDeliveryHeaders = () => {
  const records = readJsonl("outbound_delivery_headers");
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO outbound_delivery_headers
      (delivery_document, creation_date, actual_goods_movement_date, overall_goods_movement_status,
       overall_picking_status, shipping_point, header_billing_block, delivery_block_reason)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertAll = db.transaction((rows) => {
    for (const r of rows) {
      stmt.run(
        toStr(r.deliveryDocument),
        toStr(r.creationDate),
        toStr(r.actualGoodsMovementDate),
        toStr(r.overallGoodsMovementStatus),
        toStr(r.overallPickingStatus),
        toStr(r.shippingPoint),
        toStr(r.headerBillingBlockReason),
        toStr(r.deliveryBlockReason)
      );
    }
  });
  insertAll(records);
  console.log(`[SEED] outbound_delivery_headers: ${records.length} rows`);
};

const seedOutboundDeliveryItems = () => {
  const records = readJsonl("outbound_delivery_items");
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO outbound_delivery_items
      (delivery_document, delivery_document_item, actual_delivery_quantity, delivery_quantity_unit,
       plant, storage_location, reference_sd_document, reference_sd_document_item)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertAll = db.transaction((rows) => {
    for (const r of rows) {
      stmt.run(
        toStr(r.deliveryDocument),
        toStr(r.deliveryDocumentItem),
        toFloat(r.actualDeliveryQuantity),
        toStr(r.deliveryQuantityUnit),
        toStr(r.plant),
        toStr(r.storageLocation),
        toStr(r.referenceSdDocument),
        toStr(r.referenceSdDocumentItem)
      );
    }
  });
  insertAll(records);
  console.log(`[SEED] outbound_delivery_items: ${records.length} rows`);
};

const seedBillingDocumentHeaders = () => {
  const allRecords = [
    ...readJsonl("billing_document_headers"),
    ...readJsonl("billing_document_cancellations"),
  ];
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO billing_document_headers
      (billing_document, billing_document_type, creation_date, billing_document_date,
       is_cancelled, cancelled_billing_doc, total_net_amount, transaction_currency,
       company_code, fiscal_year, accounting_document, sold_to_party)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertAll = db.transaction((rows) => {
    for (const r of rows) {
      stmt.run(
        toStr(r.billingDocument),
        toStr(r.billingDocumentType),
        toStr(r.creationDate),
        toStr(r.billingDocumentDate),
        toInt(r.billingDocumentIsCancelled),
        toStr(r.cancelledBillingDocument),
        toFloat(r.totalNetAmount),
        toStr(r.transactionCurrency),
        toStr(r.companyCode),
        toStr(r.fiscalYear),
        toStr(r.accountingDocument),
        toStr(r.soldToParty)
      );
    }
  });
  insertAll(allRecords);
  console.log(`[SEED] billing_document_headers: ${allRecords.length} rows`);
};

const seedBillingDocumentItems = () => {
  const records = readJsonl("billing_document_items");
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO billing_document_items
      (billing_document, billing_document_item, material, billing_quantity, billing_quantity_unit,
       net_amount, transaction_currency, reference_sd_document, reference_sd_document_item)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertAll = db.transaction((rows) => {
    for (const r of rows) {
      stmt.run(
        toStr(r.billingDocument),
        toStr(r.billingDocumentItem),
        toStr(r.material),
        toFloat(r.billingQuantity),
        toStr(r.billingQuantityUnit),
        toFloat(r.netAmount),
        toStr(r.transactionCurrency),
        toStr(r.referenceSdDocument),
        toStr(r.referenceSdDocumentItem)
      );
    }
  });
  insertAll(records);
  console.log(`[SEED] billing_document_items: ${records.length} rows`);
};

const seedJournalEntryItems = () => {
  const records = readJsonl("journal_entry_items_accounts_receivable");
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO journal_entry_items
      (company_code, fiscal_year, accounting_document, accounting_document_item,
       gl_account, reference_document, customer, amount_in_transaction_currency,
       transaction_currency, posting_date, document_date, accounting_document_type,
       clearing_date, clearing_accounting_document, profit_center, cost_center)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertAll = db.transaction((rows) => {
    for (const r of rows) {
      stmt.run(
        toStr(r.companyCode),
        toStr(r.fiscalYear),
        toStr(r.accountingDocument),
        toStr(r.accountingDocumentItem),
        toStr(r.glAccount),
        toStr(r.referenceDocument),
        toStr(r.customer),
        toFloat(r.amountInTransactionCurrency),
        toStr(r.transactionCurrency),
        toStr(r.postingDate),
        toStr(r.documentDate),
        toStr(r.accountingDocumentType),
        toStr(r.clearingDate),
        toStr(r.clearingAccountingDocument),
        toStr(r.profitCenter),
        toStr(r.costCenter)
      );
    }
  });
  insertAll(records);
  console.log(`[SEED] journal_entry_items: ${records.length} rows`);
};

const seedPayments = () => {
  const records = readJsonl("payments_accounts_receivable");
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO payments
      (company_code, fiscal_year, accounting_document, accounting_document_item,
       clearing_date, clearing_accounting_document, amount_in_transaction_currency,
       transaction_currency, customer, posting_date, document_date, gl_account, profit_center)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertAll = db.transaction((rows) => {
    for (const r of rows) {
      stmt.run(
        toStr(r.companyCode),
        toStr(r.fiscalYear),
        toStr(r.accountingDocument),
        toStr(r.accountingDocumentItem),
        toStr(r.clearingDate),
        toStr(r.clearingAccountingDocument),
        toFloat(r.amountInTransactionCurrency),
        toStr(r.transactionCurrency),
        toStr(r.customer),
        toStr(r.postingDate),
        toStr(r.documentDate),
        toStr(r.glAccount),
        toStr(r.profitCenter)
      );
    }
  });
  insertAll(records);
  console.log(`[SEED] payments: ${records.length} rows`);
};

// ---- RUN ALL SEEDS IN ORDER (respecting FK constraints) ----

console.log("[SEED] Starting...\n");

// supporting entities first
seedBusinessPartners();
seedBusinessPartnerAddresses();
seedCustomerCompanyAssignments();
seedCustomerSalesAreaAssignments();
seedProducts();
seedProductDescriptions();
seedPlants();
seedProductPlants();
seedProductStorageLocations();

// core flow
seedSalesOrderHeaders();
seedSalesOrderItems();
seedSalesOrderScheduleLines();
seedOutboundDeliveryHeaders();
seedOutboundDeliveryItems();
seedBillingDocumentHeaders();
seedBillingDocumentItems();
seedJournalEntryItems();
seedPayments();

console.log("\n[SEED] All done.");
