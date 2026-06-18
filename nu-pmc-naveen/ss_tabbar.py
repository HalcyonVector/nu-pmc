from playwright.sync_api import sync_playwright
from pathlib import Path

PATH = Path('/home/claude/work/tabbar-test.html').resolve().as_uri()
with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={'width': 480, 'height': 2400}, device_scale_factor=2)
    page = ctx.new_page()
    page.goto(PATH)
    page.wait_for_timeout(400)
    page.screenshot(path='/home/claude/work/tabbar-test.png', full_page=True)
    browser.close()
print('saved')
