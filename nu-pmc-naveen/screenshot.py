from playwright.sync_api import sync_playwright
from pathlib import Path
import sys

PREVIEW_PATH = Path('/home/claude/work/preview.html').resolve().as_uri()

with sync_playwright() as p:
    browser = p.chromium.launch()
    context = browser.new_context(viewport={'width': 1200, 'height': 900}, device_scale_factor=2)
    page = context.new_page()
    page.goto(PREVIEW_PATH)
    # wait for both panels to render
    page.wait_for_function(
        "document.getElementById('content-monthly') && "
        "document.getElementById('content-monthly').children.length > 0"
    )
    page.wait_for_function(
        "document.getElementById('content-detail') && "
        "document.getElementById('content-detail').children.length > 0"
    )
    page.wait_for_timeout(500)

    # Full page screenshot
    page.screenshot(path='/home/claude/work/preview-full.png', full_page=True)

    # Also screenshot each panel individually for clarity
    monthly_frame = page.query_selector('#content-monthly')
    detail_frame = page.query_selector('#content-detail')

    # Screenshot just the phone-frame divs
    frames = page.query_selector_all('.phone-frame')
    if len(frames) >= 2:
        frames[0].screenshot(path='/home/claude/work/preview-monthly.png')
        frames[1].screenshot(path='/home/claude/work/preview-project-detail.png')
        print('OK — 3 screenshots saved')
    else:
        print(f'Only found {len(frames)} phone-frame divs')

    browser.close()
