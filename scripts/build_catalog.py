"""Rebuild the CC0 Chinese-title snapshot from Wikidata. Python standard library only."""
import argparse
import json
import shutil
import subprocess
from datetime import date
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
QUERY = '''SELECT ?book ?title ?author ?authorName ?type WHERE {
 VALUES ?type { wd:Q8261 wd:Q571 wd:Q7725634 }
 ?book wdt:P31 ?type; wikibase:sitelinks ?links; wdt:P50 ?author; rdfs:label ?title.
 FILTER(?links > 15 && LANGMATCHES(lang(?title),"zh"))
 ?author rdfs:label ?authorName. FILTER(lang(?authorName)="en")
} LIMIT 2000'''
HEADERS = {'User-Agent': 'ReadingJournal/1.0 (https://github.com/aaaa12342/reading)', 'Accept': 'application/json'}

def fetch(url):
    curl = shutil.which('curl.exe') or shutil.which('curl')
    if curl:
        result = subprocess.run([curl, '--fail', '--silent', '--show-error', '--retry', '1', '--max-time', '35', '-A', HEADERS['User-Agent'], url], check=True, capture_output=True)
        return json.loads(result.stdout)
    with urlopen(Request(url, headers=HEADERS), timeout=35) as response:
        return json.load(response)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--from-raw', action='store_true')
    args = parser.parse_args()
    raw_path = ROOT / 'data/wikidata-raw.json'
    raw = json.loads(raw_path.read_text('utf-8')) if args.from_raw else fetch('https://query.wikidata.org/sparql?' + urlencode({'format': 'json', 'query': QUERY}))
    raw_path.write_text(json.dumps(raw, ensure_ascii=False), 'utf-8')
    rows = raw['results']['bindings']
    author_ids = sorted({row['author']['value'].rsplit('/', 1)[-1] for row in rows})
    names = {}
    for offset in range(0, len(author_ids), 50):
        data = fetch('https://www.wikidata.org/w/api.php?' + urlencode({
            'action': 'wbgetentities', 'ids': '|'.join(author_ids[offset:offset+50]),
            'props': 'labels', 'languages': 'zh-hans|zh-cn|zh|zh-hant|zh-tw|en', 'format': 'json'}))
        for qid, entity in data.get('entities', {}).items():
            labels = entity.get('labels', {})
            names[qid] = next((labels[lang]['value'] for lang in ['zh-hans','zh-cn','zh','zh-hant','zh-tw','en'] if lang in labels), '')
    books = {}
    for row in rows:
        qid = row['book']['value'].rsplit('/', 1)[-1]
        aid = row['author']['value'].rsplit('/', 1)[-1]
        entry = books.setdefault(qid, {'title': row['title']['value'], 'authors': [], 'aliases': [],
            'category': '其他', 'source': 'Wikidata 中文书目', 'source_id': qid})
        title = row['title']['value']
        if title != entry['title'] and title not in entry['aliases']:
            entry['aliases'].append(title)
        name = names.get(aid) or row['authorName']['value']
        if name not in entry['authors']:
            entry['authors'].append(name)
        if row['type']['value'].rsplit('/', 1)[-1] in ['Q8261', 'Q7725634']:
            entry['category'] = '文学小说'
    for entry in books.values():
        entry['author'] = '、'.join(entry.pop('authors'))
    if len(books) < 100:
        raise RuntimeError('Unexpectedly small response; preserve the previous catalog')
    data = {'updated_on': date.today().isoformat(), 'license': 'CC0-1.0',
        'source': 'https://www.wikidata.org/', 'query': QUERY, 'books': list(books.values())}
    (ROOT / 'data/catalog-zh.json').write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n', 'utf-8')
    print(f"Saved {len(books)} books, resolved {len(names)} authors")

if __name__ == '__main__':
    main()
