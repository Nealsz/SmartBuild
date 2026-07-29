"""
services/supabase_service.py
Manages connection to Supabase database and provides helper functions to fetch
component datasets directly into pandas DataFrames.
"""

import logging
import pandas as pd
from typing import Optional
from supabase import create_client, Client
from config import SUPABASE_URL, SUPABASE_KEY

logger = logging.getLogger(__name__)

_client: Optional[Client] = None
_client_initialized: bool = False

# Mapping internal component names to actual Supabase table names (case-sensitive)
TABLE_NAME_MAP = {
    "cpu":         ["CPU", "cpu", "cpus"],
    "gpu":         ["GPU", "gpu", "gpus"],
    "ram":         ["RAM", "ram", "rams"],
    "storage":     ["Storage", "storage", "storages"],
    "motherboard": ["Motherboard", "motherboard", "motherboards"],
    "psu":         ["PSU", "psu", "psus"],
    "case":        ["Case", "case", "cases"],
    "cpu_cooler":  ["CPU Cooler", "cpu_cooler", "cpu_coolers"],
    "case_fan":    ["Case Fan", "case_fan", "case_fans"],
}


def get_supabase_client() -> Optional[Client]:
    """Returns initialized Supabase client singleton, or None if unconfigured."""
    global _client, _client_initialized
    if not _client_initialized:
        if SUPABASE_URL and SUPABASE_KEY:
            try:
                _client = create_client(SUPABASE_URL, SUPABASE_KEY)
                logger.info("Successfully connected to Supabase client.")
            except Exception as e:
                logger.warning(f"Failed to initialize Supabase client: {e}")
                _client = None
        else:
            logger.info("Supabase URL or Key not set. Operating in offline/CSV fallback mode.")
            _client = None
        _client_initialized = True
    return _client


def is_supabase_configured() -> bool:
    """Returns True if Supabase credentials are configured."""
    return bool(SUPABASE_URL and SUPABASE_KEY)


def fetch_table_as_dataframe(component_name: str) -> Optional[pd.DataFrame]:
    """
    Fetches data for a component from Supabase and returns a pandas DataFrame.
    Handles pagination to fetch all rows (PostgREST default limit is 1000).
    Returns None if fetch fails or Supabase is not available.
    """
    client = get_supabase_client()
    if not client:
        return None

    candidate_tables = TABLE_NAME_MAP.get(component_name, [component_name])
    
    for table_name in candidate_tables:
        try:
            all_records = []
            page_size = 1000
            offset = 0

            while True:
                response = client.table(table_name).select("*").range(offset, offset + page_size - 1).execute()
                data = response.data
                if not data:
                    break
                all_records.extend(data)
                if len(data) < page_size:
                    break
                offset += page_size

            df = pd.DataFrame(all_records)
            logger.info(f"Loaded {len(df)} rows from Supabase table '{table_name}' for component '{component_name}'.")
            return df
        except Exception as e:
            logger.debug(f"Could not fetch table '{table_name}' from Supabase: {e}")
            continue

    logger.warning(f"Failed to fetch component '{component_name}' from Supabase tables ({candidate_tables}).")
    return None
