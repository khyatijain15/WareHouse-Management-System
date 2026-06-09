// Configuration file for field names and patterns used across the application
// This centralizes all field name mappings to avoid hardcoded values

export const FIELD_NAMES = {
  // Inward collection field names
  INWARD: {
    COMMODITY: 'commodity',
    COMMODITY_NAME: 'commodityName',
    VARIETY: 'variety',
    VARIETY_NAME: 'varietyName',
    WAREHOUSE_CODE: 'warehouseCode',
    WAREHOUSE_NAME: 'warehouseName',
    CLIENT_CODE: 'clientCode',
    EYE_NUMBER: 'eyeNumber',
    INWARD_ID: 'inwardId',
    INWARD_ENTRIES: 'inwardEntries',
    ENTRY_NUMBER: 'entryNumber'
  },
  // Delivery order field names
  DELIVERY_ORDER: {
    COMMODITY: 'commodity',
    COMMODITY_NAME: 'commodityName',
    VARIETY: 'variety',
    VARIETY_NAME: 'varietyName',
    WAREHOUSE_CODE: 'warehouseCode',
    WAREHOUSE_NAME: 'warehouseName',
    CLIENT_CODE: 'clientCode',
    EYE_NUMBER: 'eyeNumber',
    SRWR_NO: 'srwrNo',
    COMMODITY_ID: 'commodityId',
    VARIETY_ID: 'varietyId'
  },
  // Inspections collection field names
  INSPECTIONS: {
    WAREHOUSE_NAME: 'warehouseName',
    WAREHOUSE_CODE: 'warehouseCode',
    WAREHOUSE_ADDRESS: 'warehouseAddress',
    TYPE_OF_WAREHOUSE: 'typeOfWarehouse',
    BUSINESS_TYPE: 'businessType',
    DATABASE_LOCATION: 'databaseLocation'
  },
  // Commodities collection field names
  COMMODITIES: {
    COMMODITY_ID: 'commodityId',
    COMMODITY_NAME: 'commodityName',
    VARIETIES: 'varieties',
    VARIETY_ID: 'varietyId',
    VARIETY_NAME: 'varietyName'
  }
};

// Search patterns and collection names
export const SEARCH_PATTERNS = {
  INWARD_ID_PREFIX: 'INW-',
  COLLECTIONS: {
    INWARD: 'inward',
    COMMODITIES: 'commodities',
    INSPECTIONS: 'inspections',
    DELIVERY_ORDERS: 'deliveryOrders'
  }
};

// Search strategies configuration
export const SEARCH_STRATEGIES = {
  INWARD_DATA: [
    {
      name: 'eye_number_warehouse',
      description: 'Search by eye number and warehouse name',
      fields: ['eyeNumber', 'warehouseName'],
      priority: 1
    },
    {
      name: 'warehouse_code',
      description: 'Search by warehouse code',
      fields: ['warehouseCode'],
      priority: 2
    },
    {
      name: 'warehouse_name',
      description: 'Search by warehouse name',
      fields: ['warehouseName'],
      priority: 3
    },
    {
      name: 'inward_id',
      description: 'Search by inward ID pattern',
      fields: ['inwardId'],
      priority: 4
    },
    {
      name: 'client_code_warehouse',
      description: 'Search by client code and warehouse',
      fields: ['clientCode', 'warehouseName'],
      priority: 5
    }
  ]
};

// Field extraction configuration
export const FIELD_EXTRACTION = {
  COMMODITY_FIELDS: [
    'commodity',
    'commodityName'
  ],
  VARIETY_FIELDS: [
    'varietyName',
    'variety'
  ],
  INWARD_ENTRIES_INDEX: 0 // Which entry to use from inwardEntries array
};

// Default values
export const DEFAULTS = {
  NOT_FOUND: 'NOT FOUND',
  EMPTY_STRING: '',
  FALLBACK_INDEX: 0
};
