-- ============================================================
-- SUPPORTING ENTITIES
-- ============================================================

CREATE TABLE IF NOT EXISTS business_partners (
  business_partner        TEXT PRIMARY KEY,
  customer                TEXT,
  full_name               TEXT,
  name                    TEXT,
  partner_category        TEXT,
  creation_date           TEXT,
  last_change_date        TEXT,
  is_blocked              INTEGER DEFAULT 0,
  is_archived             INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS business_partner_addresses (
  business_partner        TEXT,
  address_id              TEXT,
  city_name               TEXT,
  country                 TEXT,
  postal_code             TEXT,
  region                  TEXT,
  street_name             TEXT,
  address_time_zone       TEXT,
  PRIMARY KEY (business_partner, address_id),
  FOREIGN KEY (business_partner) REFERENCES business_partners(business_partner)
);

CREATE TABLE IF NOT EXISTS customer_company_assignments (
  customer                TEXT,
  company_code            TEXT,
  payment_terms           TEXT,
  reconciliation_account  TEXT,
  deletion_indicator      INTEGER DEFAULT 0,
  PRIMARY KEY (customer, company_code),
  FOREIGN KEY (customer) REFERENCES business_partners(business_partner)
);

CREATE TABLE IF NOT EXISTS customer_sales_area_assignments (
  customer                TEXT,
  sales_organization      TEXT,
  distribution_channel    TEXT,
  division                TEXT,
  PRIMARY KEY (customer, sales_organization, distribution_channel, division),
  FOREIGN KEY (customer) REFERENCES business_partners(business_partner)
);

CREATE TABLE IF NOT EXISTS products (
  product                 TEXT PRIMARY KEY,
  product_type            TEXT,
  product_old_id          TEXT,
  gross_weight            REAL,
  net_weight              REAL,
  weight_unit             TEXT,
  base_unit               TEXT,
  product_group           TEXT,
  division                TEXT,
  industry_sector         TEXT,
  creation_date           TEXT,
  last_change_date        TEXT,
  is_marked_for_deletion  INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS product_descriptions (
  product                 TEXT,
  language                TEXT,
  product_description     TEXT,
  PRIMARY KEY (product, language),
  FOREIGN KEY (product) REFERENCES products(product)
);

CREATE TABLE IF NOT EXISTS plants (
  plant                   TEXT PRIMARY KEY,
  plant_name              TEXT,
  sales_organization      TEXT,
  distribution_channel    TEXT,
  division                TEXT,
  address_id              TEXT,
  factory_calendar        TEXT
);

CREATE TABLE IF NOT EXISTS product_plants (
  product                 TEXT,
  plant                   TEXT,
  PRIMARY KEY (product, plant),
  FOREIGN KEY (product) REFERENCES products(product),
  FOREIGN KEY (plant) REFERENCES plants(plant)
);

CREATE TABLE IF NOT EXISTS product_storage_locations (
  product                 TEXT,
  plant                   TEXT,
  storage_location        TEXT,
  PRIMARY KEY (product, plant, storage_location),
  FOREIGN KEY (product) REFERENCES products(product),
  FOREIGN KEY (plant) REFERENCES plants(plant)
);

-- ============================================================
-- CORE FLOW ENTITIES
-- ============================================================

CREATE TABLE IF NOT EXISTS sales_order_headers (
  sales_order             TEXT PRIMARY KEY,
  sales_order_type        TEXT,
  sales_organization      TEXT,
  distribution_channel    TEXT,
  sold_to_party           TEXT,
  creation_date           TEXT,
  total_net_amount        REAL,
  transaction_currency    TEXT,
  overall_delivery_status TEXT,
  overall_billing_status  TEXT,
  pricing_date            TEXT,
  requested_delivery_date TEXT,
  header_billing_block    TEXT,
  delivery_block_reason   TEXT,
  customer_payment_terms  TEXT,
  FOREIGN KEY (sold_to_party) REFERENCES business_partners(business_partner)
);

CREATE TABLE IF NOT EXISTS sales_order_items (
  sales_order             TEXT,
  sales_order_item        TEXT,
  material                TEXT,
  requested_quantity      REAL,
  quantity_unit           TEXT,
  net_amount              REAL,
  transaction_currency    TEXT,
  material_group          TEXT,
  production_plant        TEXT,
  storage_location        TEXT,
  PRIMARY KEY (sales_order, sales_order_item),
  FOREIGN KEY (sales_order) REFERENCES sales_order_headers(sales_order),
  FOREIGN KEY (material) REFERENCES products(product),
  FOREIGN KEY (production_plant) REFERENCES plants(plant)
);

CREATE TABLE IF NOT EXISTS sales_order_schedule_lines (
  sales_order             TEXT,
  sales_order_item        TEXT,
  schedule_line           TEXT,
  confirmed_delivery_date TEXT,
  order_quantity_unit     TEXT,
  confirmed_quantity      REAL,
  PRIMARY KEY (sales_order, sales_order_item, schedule_line),
  FOREIGN KEY (sales_order, sales_order_item) REFERENCES sales_order_items(sales_order, sales_order_item)
);

CREATE TABLE IF NOT EXISTS outbound_delivery_headers (
  delivery_document               TEXT PRIMARY KEY,
  creation_date                   TEXT,
  actual_goods_movement_date      TEXT,
  overall_goods_movement_status   TEXT,
  overall_picking_status          TEXT,
  shipping_point                  TEXT,
  header_billing_block            TEXT,
  delivery_block_reason           TEXT
);

CREATE TABLE IF NOT EXISTS outbound_delivery_items (
  delivery_document               TEXT,
  delivery_document_item          TEXT,
  actual_delivery_quantity        REAL,
  delivery_quantity_unit          TEXT,
  plant                           TEXT,
  storage_location                TEXT,
  reference_sd_document           TEXT,
  reference_sd_document_item      TEXT,
  PRIMARY KEY (delivery_document, delivery_document_item),
  FOREIGN KEY (delivery_document) REFERENCES outbound_delivery_headers(delivery_document),
  FOREIGN KEY (plant) REFERENCES plants(plant),
  FOREIGN KEY (reference_sd_document) REFERENCES sales_order_headers(sales_order)
);

CREATE TABLE IF NOT EXISTS billing_document_headers (
  billing_document        TEXT PRIMARY KEY,
  billing_document_type   TEXT,
  creation_date           TEXT,
  billing_document_date   TEXT,
  is_cancelled            INTEGER DEFAULT 0,
  cancelled_billing_doc   TEXT,
  total_net_amount        REAL,
  transaction_currency    TEXT,
  company_code            TEXT,
  fiscal_year             TEXT,
  accounting_document     TEXT,
  sold_to_party           TEXT,
  FOREIGN KEY (sold_to_party) REFERENCES business_partners(business_partner)
);

CREATE TABLE IF NOT EXISTS billing_document_items (
  billing_document        TEXT,
  billing_document_item   TEXT,
  material                TEXT,
  billing_quantity        REAL,
  billing_quantity_unit   TEXT,
  net_amount              REAL,
  transaction_currency    TEXT,
  reference_sd_document   TEXT,
  reference_sd_document_item TEXT,
  PRIMARY KEY (billing_document, billing_document_item),
  FOREIGN KEY (billing_document) REFERENCES billing_document_headers(billing_document),
  FOREIGN KEY (material) REFERENCES products(product),
  FOREIGN KEY (reference_sd_document) REFERENCES outbound_delivery_headers(delivery_document)
);

CREATE TABLE IF NOT EXISTS journal_entry_items (
  company_code                    TEXT,
  fiscal_year                     TEXT,
  accounting_document             TEXT,
  accounting_document_item        TEXT,
  gl_account                      TEXT,
  reference_document              TEXT,
  customer                        TEXT,
  amount_in_transaction_currency  REAL,
  transaction_currency            TEXT,
  posting_date                    TEXT,
  document_date                   TEXT,
  accounting_document_type        TEXT,
  clearing_date                   TEXT,
  clearing_accounting_document    TEXT,
  profit_center                   TEXT,
  cost_center                     TEXT,
  PRIMARY KEY (company_code, fiscal_year, accounting_document, accounting_document_item),
  FOREIGN KEY (reference_document) REFERENCES billing_document_headers(billing_document),
  FOREIGN KEY (customer) REFERENCES business_partners(business_partner)
);

CREATE TABLE IF NOT EXISTS payments (
  company_code                    TEXT,
  fiscal_year                     TEXT,
  accounting_document             TEXT,
  accounting_document_item        TEXT,
  clearing_date                   TEXT,
  clearing_accounting_document    TEXT,
  amount_in_transaction_currency  REAL,
  transaction_currency            TEXT,
  customer                        TEXT,
  posting_date                    TEXT,
  document_date                   TEXT,
  gl_account                      TEXT,
  profit_center                   TEXT,
  PRIMARY KEY (company_code, fiscal_year, accounting_document, accounting_document_item),
  FOREIGN KEY (customer) REFERENCES business_partners(business_partner)
);
