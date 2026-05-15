import os
from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1280, 'height': 1200})
        try:
            page.goto('http://localhost:3000', wait_until='networkidle')
            # Wait a bit for animations if any
            page.wait_for_timeout(2000)
            
            # Create artifacts dir if it doesn't exist
            os.makedirs('C:/Users/cerqu/.gemini/antigravity/brain/58937507-83c0-4f9a-8084-c77b62009b2c/artifacts', exist_ok=True)
            
            screenshot_path = 'C:/Users/cerqu/.gemini/antigravity/brain/58937507-83c0-4f9a-8084-c77b62009b2c/artifacts/dashboard_preview.png'
            page.screenshot(path=screenshot_path, full_page=True)
            print(f"Screenshot saved to {screenshot_path}")
        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    run()
