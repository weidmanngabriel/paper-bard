import { expect, test } from '@playwright/test'

test('mobile Hauptnavigation öffnet alle Bereiche', async ({ page }) => {
  await page.goto('/paper-bard/#/session')
  await expect(page.getByRole('heading', { name: 'Deine Session' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Stop All/ })).toBeVisible()

  await page.getByRole('link', { name: 'Library' }).click()
  await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible()

  await page.getByRole('link', { name: 'Aufnahme' }).click()
  await expect(page.getByRole('button', { name: 'Aufnahme starten' })).toBeVisible()

  await page.getByRole('link', { name: 'Einstellungen' }).click()
  await expect(page.getByRole('heading', { name: 'Einstellungen' })).toBeVisible()
})

test('App-Shell lädt nach Installation auch offline', async ({ page, context }) => {
  await page.goto('/paper-bard/#/session')
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Deine Session' })).toBeVisible()
  await context.setOffline(false)
})
