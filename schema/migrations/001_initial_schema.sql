-- ==============================================================================
-- Schema: open-pl-address SQLite Database
-- Optimized for instant search, autocomplete, and strict ZUS Płatnik / Gratyfikant validation
-- ==============================================================================

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;

-- 1. Administrative division GUS TERYT (TERC)
CREATE TABLE IF NOT EXISTS terc (
    teryt_code   TEXT PRIMARY KEY, -- 7 digits: WOJ(2) + POW(2) + GMI(2) + RODZ(1), e.g. 0663011
    wojewodztwo  TEXT NOT NULL,    -- e.g. LUBELSKIE
    powiat       TEXT NOT NULL,    -- e.g. m. Lublin
    gmina        TEXT NOT NULL,    -- e.g. Lublin
    rodzaj_gminy TEXT NOT NULL     -- e.g. gmina miejska (1)
);

-- 2. Populated places (SIMC)
CREATE TABLE IF NOT EXISTS cities (
    simc_id         TEXT PRIMARY KEY, -- 7-digit SIMC identifier
    teryt_code      TEXT NOT NULL REFERENCES terc(teryt_code),
    name            TEXT NOT NULL,    -- Official city name for Gratyfikant/Płatnik
    name_normalized TEXT NOT NULL,    -- Lowercase without Polish diacritics & transliterated
    postal_codes    TEXT NOT NULL     -- JSON array of postal codes: ["20-001", "20-002", ...]
);

CREATE INDEX IF NOT EXISTS idx_cities_norm ON cities(name_normalized);
CREATE INDEX IF NOT EXISTS idx_cities_teryt ON cities(teryt_code);

-- 3. Streets (ULIC + aggregated PRG building numbers)
CREATE TABLE IF NOT EXISTS streets (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    simc_id         TEXT NOT NULL REFERENCES cities(simc_id),
    ulic_id         TEXT,             -- 5-digit ULIC identifier, NULL for villages without streets
    cecha           TEXT NOT NULL,    -- Prefix type: ul., al., pl., os., skwer, rondo
    name            TEXT NOT NULL,    -- Official street name for Gratyfikant/Płatnik
    name_normalized TEXT NOT NULL,    -- Lowercase without Polish diacritics
    buildings_map   TEXT NOT NULL     -- JSON map: {"20-002": ["1", "2", "3A", "5"]}
);

CREATE INDEX IF NOT EXISTS idx_streets_simc ON streets(simc_id);
CREATE INDEX IF NOT EXISTS idx_streets_ulic ON streets(ulic_id);
CREATE INDEX IF NOT EXISTS idx_streets_norm ON streets(name_normalized);
CREATE INDEX IF NOT EXISTS idx_streets_simc_norm ON streets(simc_id, name_normalized);

-- 4. Fast Postal Code Index (XX-XXX -> SIMC / Street)
CREATE TABLE IF NOT EXISTS postal_code_index (
    postal_code TEXT NOT NULL,        -- Format: XX-XXX
    simc_id     TEXT NOT NULL REFERENCES cities(simc_id),
    street_id   INTEGER REFERENCES streets(id),
    PRIMARY KEY (postal_code, simc_id, street_id)
);

CREATE INDEX IF NOT EXISTS idx_postal_code ON postal_code_index(postal_code);
CREATE INDEX IF NOT EXISTS idx_postal_code_simc ON postal_code_index(postal_code, simc_id);

-- 5. Full-Text Search (FTS5) for instant prefix search & autocomplete
CREATE VIRTUAL TABLE IF NOT EXISTS cities_fts USING fts5(
    simc_id UNINDEXED,
    name_normalized,
    name,
    tokenize = 'unicode61'
);

CREATE VIRTUAL TABLE IF NOT EXISTS streets_fts USING fts5(
    street_id UNINDEXED,
    simc_id UNINDEXED,
    name_normalized,
    name,
    tokenize = 'unicode61'
);

-- 6. Urząd Skarbowy (Tax Offices - Ministerstwo Finansów)
CREATE TABLE IF NOT EXISTS tax_offices (
    us_code     TEXT PRIMARY KEY, -- 4 digits MF code, e.g. "0610"
    name        TEXT NOT NULL,    -- Official name, e.g. "Pierwszy Urząd Skarbowy w Lublinie"
    city        TEXT,             -- Office city
    street      TEXT,             -- Office street
    postal_code TEXT              -- Office postal code
);

-- 7. Tax Office Rules (Territorial jurisdiction mapping by specificity hierarchy)
CREATE TABLE IF NOT EXISTS tax_office_rules (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    us_code          TEXT NOT NULL REFERENCES tax_offices(us_code),
    teryt_code       TEXT NOT NULL,    -- TERC code (7 digits or prefix, e.g. "0663011")
    simc_id          TEXT,             -- 7-digit SIMC identifier (nullable)
    ulic_id          TEXT,             -- 5-digit ULIC identifier (nullable)
    building_parity  TEXT DEFAULT 'ALL', -- 'ALL', 'EVEN', 'ODD'
    building_from    INTEGER,          -- Range start (inclusive, nullable)
    building_to      INTEGER,          -- Range end (inclusive, nullable)
    priority         INTEGER NOT NULL  -- 1: street + range/parity, 2: whole street, 3: city, 4: gmina
);

CREATE INDEX IF NOT EXISTS idx_tax_rules_lookup ON tax_office_rules(teryt_code, simc_id, ulic_id, priority);
CREATE INDEX IF NOT EXISTS idx_tax_rules_us ON tax_office_rules(us_code);
CREATE INDEX IF NOT EXISTS idx_tax_rules_priority ON tax_office_rules(priority);

-- Metadata table for version tracking & integrity
CREATE TABLE IF NOT EXISTS db_metadata (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
