"""
Gemini Share Link and Canvas Artifact Extractor
Extracts conversation turns, model responses, and Canvas artifacts from Gemini share links.
"""

import urllib.request
import urllib.parse
import re
import json
from typing import Dict, Any, List, Optional


def extract_share_id(url_or_id: str) -> str:
    """Extracts the clean Gemini share ID from various URL formats or direct ID."""
    url_or_id = url_or_id.strip()
    
    # If it's already an alphanumeric ID
    if re.match(r'^[a-zA-Z0-9_-]{10,20}$', url_or_id):
        return url_or_id
        
    # Match /share/<id>
    match = re.search(r'/share/([a-zA-Z0-9_-]+)', url_or_id)
    if match:
        return match.group(1)
        
    return ""


def resolve_canonical_url(url: str) -> tuple[str, str, str, str]:
    """
    Follows HTTP redirect to obtain canonical share URL and extracts session metadata.
    Returns: (canonical_url, share_id, f_sid, bl)
    """
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    }
    
    # Ensure scheme
    if not url.startswith('http://') and not url.startswith('https://'):
        url = 'https://' + url
        
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=15) as resp:
        final_url = resp.geturl()
        html = resp.read().decode('utf-8', errors='replace')
        
    share_id = extract_share_id(final_url)
    if not share_id:
        share_id = extract_share_id(html)
        
    if not share_id:
        canonical_match = re.search(r'canonical"\s+href="([^"]+)"', html)
        if canonical_match:
            share_id = extract_share_id(canonical_match.group(1))
            
    if not share_id:
        raise ValueError(f"Could not identify a valid Gemini Share ID from {url}")
        
    f_sid_match = re.search(r'"FdrFJe":"([^"]+)"', html)
    f_sid = f_sid_match.group(1) if f_sid_match else ""
    
    bl_match = re.search(r'"cfb2h":"([^"]+)"', html) or re.search(r'boq_assistant-bard-web-server[^\&"\s]+', html)
    bl = bl_match.group(0) if bl_match else "boq_assistant-bard-web-server_20260827.05_p0"
    
    return final_url, share_id, f_sid, bl


def fetch_via_batchexecute(share_id: str, f_sid: str = "", bl: str = "") -> Dict[str, Any]:
    """
    Queries Gemini's batchexecute RPC (ujx1Bf) directly via HTTP POST.
    """
    rpc_payload = json.dumps([[["ujx1Bf", json.dumps([None, share_id, [4]]), None, "generic"]]])
    post_data = urllib.parse.urlencode({'f.req': rpc_payload}).encode('utf-8')
    
    bl_val = bl if bl else "boq_assistant-bard-web-server_20260827.05_p0"
    rpc_url = f"https://gemini.google.com/_/BardChatUi/data/batchexecute?rpcids=ujx1Bf&source-path=%2Fshare%2F{share_id}&f.sid={f_sid}&bl={bl_val}&hl=en-US&_reqid=100000&rt=c"
    
    rpc_headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'Referer': f'https://gemini.google.com/share/{share_id}',
        'x-same-domain': '1'
    }
    
    req = urllib.request.Request(rpc_url, data=post_data, headers=rpc_headers)
    with urllib.request.urlopen(req, timeout=15) as resp:
        rpc_text = resp.read().decode('utf-8', errors='replace')
        
    lines = rpc_text.split('\n')
    parsed_json = None
    for line in lines:
        line = line.strip()
        if line.startswith('[['):
            try:
                outer = json.loads(line)
                for item in outer:
                    if len(item) > 2 and item[0] == 'wrb.fr' and item[1] == 'ujx1Bf':
                        parsed_json = json.loads(item[2])
                        break
                if parsed_json:
                    break
            except Exception:
                continue
                
    if not parsed_json:
        raise ValueError("Unable to parse batchexecute response from Gemini servers")
        
    return parsed_json


def parse_gemini_payload(parsed_json: Any, share_id: str, original_url: str, final_url: str) -> Dict[str, Any]:
    """
    Parses the recursive Gemini JSON structure and extracts turns, messages, and canvas artifacts.
    """
    result = {
        "share_id": share_id,
        "original_url": original_url,
        "final_url": final_url,
        "title": "Gemini Shared Artifact",
        "turns": [],
        "artifacts": [],
        "ascii_count": 0,
        "table_count": 0
    }
    
    try:
        root = parsed_json[0]
        turns_data = root[1] if len(root) > 1 and root[1] else []
        
        for t_idx, t in enumerate(turns_data):
            turn_obj = {
                "turn_index": t_idx + 1,
                "user_prompt": "",
                "model_text": "",
                "artifacts": []
            }
            
            # Extract user prompt
            if len(t) > 2 and t[2] and isinstance(t[2], list) and len(t[2]) > 0:
                if isinstance(t[2][0], list) and len(t[2][0]) > 0:
                    turn_obj["user_prompt"] = t[2][0][0] or ""
                elif isinstance(t[2][0], str):
                    turn_obj["user_prompt"] = t[2][0]
                    
            # Extract candidate responses
            if len(t) > 3 and t[3] and len(t[3]) > 0:
                c0 = t[3][0]
                if c0 and isinstance(c0, list) and len(c0) > 0:
                    c_info = c0[0]
                    if len(c_info) > 1 and c_info[1] and len(c_info[1]) > 0:
                        turn_obj["model_text"] = c_info[1][0] or ""
                        
                    # Scan c_info for canvas artifacts (index 30 or any matching list)
                    for sub in c_info:
                        if isinstance(sub, list) and len(sub) > 0:
                            for item in sub:
                                if isinstance(item, list) and len(item) >= 5 and isinstance(item[4], str) and len(item[4]) > 30:
                                    # Candidate for artifact
                                    art_title = item[2] if len(item) > 2 and item[2] else "Canvas Artifact"
                                    art_filename = item[9] if len(item) > 9 and item[9] else "artifact.md"
                                    content = item[4]
                                    
                                    # Count ASCII diagrams (multi-line code blocks) and tables
                                    ascii_matches = [m for m in re.findall(r'```[\s\S]*?```', content) if '\n' in m or len(m) > 30]
                                    table_matches = re.findall(r'(\n\s*\|[^\n]+\|\s*\n\s*\|\s*[-:|\s]+\|\s*\n(?:\s*\|[^\n]+\|\s*\n?)+)', '\n' + content)
                                    
                                    art_data = {
                                        "id": item[0] if len(item) > 0 else f"art_{len(result['artifacts'])+1}",
                                        "uuid": item[1] if len(item) > 1 else "",
                                        "title": art_title,
                                        "filename": art_filename,
                                        "content": content,
                                        "char_count": len(content),
                                        "word_count": len(content.split()),
                                        "ascii_count": len(ascii_matches),
                                        "table_count": len(table_matches)
                                    }
                                    turn_obj["artifacts"].append(art_data)
                                    result["artifacts"].append(art_data)
                                    
                                    if result["title"] == "Gemini Shared Artifact" and art_title:
                                        result["title"] = art_title
                                        
            result["turns"].append(turn_obj)
            
    except Exception as e:
        print(f"Parsing warning: {e}")
        
    # Aggregate statistics
    total_ascii = sum(art.get("ascii_count", 0) for art in result["artifacts"])
    total_tables = sum(art.get("table_count", 0) for art in result["artifacts"])
    
    # If no artifacts found at c_info[30], use the model_text as the primary document
    if not result["artifacts"] and result["turns"]:
        for t in result["turns"]:
            if t["model_text"]:
                m_content = t["model_text"]
                ascii_matches = [m for m in re.findall(r'```[\s\S]*?```', m_content) if '\n' in m or len(m) > 30]
                table_matches = re.findall(r'(\n\s*\|[^\n]+\|\s*\n\s*\|\s*[-:|\s]+\|\s*\n(?:\s*\|[^\n]+\|\s*\n?)+)', '\n' + m_content)
                art_data = {
                    "id": "chat_response",
                    "uuid": "",
                    "title": result["title"],
                    "filename": "response.md",
                    "content": m_content,
                    "char_count": len(m_content),
                    "word_count": len(m_content.split()),
                    "ascii_count": len(ascii_matches),
                    "table_count": len(table_matches)
                }
                result["artifacts"].append(art_data)
                total_ascii += len(ascii_matches)
                total_tables += len(table_matches)
                break
                
    result["ascii_count"] = total_ascii
    result["table_count"] = total_tables
    
    return result


def extract_gemini_content(url: str) -> Dict[str, Any]:
    """
    Complete end-to-end extraction pipeline for any Gemini share URL or canvas artifact.
    """
    final_url, share_id, f_sid, bl = resolve_canonical_url(url)
    parsed_json = fetch_via_batchexecute(share_id, f_sid, bl)
    result = parse_gemini_payload(parsed_json, share_id, url, final_url)
    return result
