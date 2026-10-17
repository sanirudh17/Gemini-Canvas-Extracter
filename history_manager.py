"""
History Manager for Gemini Canvas Extractor
Persists extracted artifacts and export history in a local JSON database.
"""

import os
import json
import time
from typing import List, Dict, Any, Optional

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
HISTORY_FILE = os.path.join(DATA_DIR, "history.json")

def ensure_data_dir():
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(HISTORY_FILE):
        with open(HISTORY_FILE, "w", encoding="utf-8") as f:
            json.dump([], f)

def get_history() -> List[Dict[str, Any]]:
    ensure_data_dir()
    try:
        with open(HISTORY_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []

def add_history_entry(entry: Dict[str, Any]) -> Dict[str, Any]:
    ensure_data_dir()
    history = get_history()
    
    # Check if this share_id or title already exists, update if so
    entry_id = entry.get("id") or str(int(time.time() * 1000))
    entry["id"] = entry_id
    entry["timestamp"] = entry.get("timestamp") or time.strftime("%b %d, %Y %I:%M %p")
    entry["created_at"] = entry.get("created_at") or time.time()
    
    # Check if previously starred
    was_starred = False
    share_id = entry.get("share_id")
    for old_item in history:
        if (share_id and old_item.get("share_id") == share_id) or old_item.get("id") == entry_id:
            if old_item.get("starred"):
                was_starred = True
            break
    if "starred" not in entry:
        entry["starred"] = was_starred
    else:
        entry["starred"] = bool(entry["starred"])
    
    # Filter out existing with same id or same share_id
    if share_id:
        history = [item for item in history if item.get("share_id") != share_id]
    else:
        history = [item for item in history if item.get("id") != entry_id]
        
    # Prepend latest
    history.insert(0, entry)
    
    # Keep max 50 items
    history = history[:50]
    
    with open(HISTORY_FILE, "w", encoding="utf-8") as f:
        json.dump(history, f, indent=2, ensure_ascii=False)
        
    return entry

def toggle_star_history_entry(entry_id: str) -> Optional[Dict[str, Any]]:
    ensure_data_dir()
    history = get_history()
    target = None
    for item in history:
        if item.get("id") == entry_id:
            item["starred"] = not item.get("starred", False)
            target = item
            break
    if target is not None:
        with open(HISTORY_FILE, "w", encoding="utf-8") as f:
            json.dump(history, f, indent=2, ensure_ascii=False)
    return target

def delete_history_entry(entry_id: str) -> bool:
    ensure_data_dir()
    history = get_history()
    initial_len = len(history)
    history = [item for item in history if item.get("id") != entry_id]
    if len(history) != initial_len:
        with open(HISTORY_FILE, "w", encoding="utf-8") as f:
            json.dump(history, f, indent=2, ensure_ascii=False)
        return True
    return False

def clear_all_history() -> bool:
    ensure_data_dir()
    with open(HISTORY_FILE, "w", encoding="utf-8") as f:
        json.dump([], f)
    return True
