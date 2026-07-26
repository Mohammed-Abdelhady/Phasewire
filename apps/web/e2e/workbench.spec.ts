import { expect, test, type Page } from '@playwright/test'

import { selectors } from './utils/selectors'

const SERVICE_ORIGIN = 'http://127.0.0.1:4317'
const WORKFLOW_ID = 'wf-live-e2e'

async function openLiveWorkbench(page: Page): Promise<void> {
  await page.goto(`${SERVICE_ORIGIN}/session?token=phasewire-e2e-token&workflow=${WORKFLOW_ID}`)
  await page.goto(`/#workflow=${WORKFLOW_ID}`)
  await expect(page.locator(selectors.offlineBanner)).toHaveCount(0)
  await expect(page.locator(selectors.reportCanvas)).toBeVisible()
  await page.locator(selectors.phasePlan).click()
}

async function postHarnessAction(page: Page, action: string): Promise<void> {
  const response = await page.request.post(
    `${SERVICE_ORIGIN}/api/workflows/${WORKFLOW_ID}/actions/${action}`,
    {
      data: { actor: 'e2e-harness', payload: {} },
      headers: { authorization: 'Bearer phasewire-e2e-token' },
    },
  )
  expect(response.ok()).toBe(true)
}

test.describe('live local service integration', () => {
  test('loads API state and persists decisions, approval, and the explicit deployment gate', async ({ page }) => {
    await openLiveWorkbench(page)

    await page.locator(selectors.decisionTitle).fill('Persistence strategy')
    await page.locator(selectors.decisionOutcome).fill('Use immutable event files')
    await page.locator(selectors.recordDecision).click()
    await expect(page.locator(selectors.decisionCards)).toHaveCount(1)

    await page.locator(selectors.approvePlan).click()
    await expect(page.locator(selectors.approvePlan)).toHaveText('Approved')

    await page.reload()
    await page.locator(selectors.phasePlan).click()
    await expect(page.locator(selectors.decisionCards)).toHaveCount(1)
    await expect(page.locator(selectors.approvePlan)).toHaveText('Approved')

    await postHarnessAction(page, 'start-execution')
    await postHarnessAction(page, 'complete-execution')
    await postHarnessAction(page, 'start-review')
    await postHarnessAction(page, 'complete-review')
    await page.reload()
    await page.locator(selectors.phaseReady).click()
    await expect(page.locator(selectors.authorizeDeployment)).toBeEnabled()
    await expect(page.locator(selectors.authorizeDeployment)).toHaveText('Authorize deployment')
    await page.locator(selectors.authorizeDeployment).click()
    await expect(page.locator(selectors.authorizeDeployment)).toHaveText('Authorization recorded')
  })

  test('preserves decision input and associates a visible error when an action fails', async ({ page }) => {
    await openLiveWorkbench(page)
    await page.route('**/api/workflows/*/actions/decision', async (route) => {
      await route.fulfill({
        body: JSON.stringify({ error: 'Forced persistence failure' }),
        contentType: 'application/json',
        status: 503,
      })
    })

    await page.locator(selectors.decisionTitle).fill('Retained decision')
    await page.locator(selectors.decisionOutcome).fill('Retained outcome')
    await page.locator(selectors.recordDecision).click()

    await expect(page.locator(selectors.decisionTitle)).toHaveValue('Retained decision')
    await expect(page.locator(selectors.decisionOutcome)).toHaveValue('Retained outcome')
    await expect(page.locator('#decision-composer-error')).toBeVisible()
    await expect(page.locator(selectors.actionError)).toBeVisible()
    await expect(page.locator(selectors.decisionTitle)).toHaveAttribute('aria-describedby', 'decision-composer-error')

    await page.route('**/api/workflows/*/actions/annotation', async (route) => {
      await route.fulfill({
        body: JSON.stringify({ error: 'Forced annotation failure' }),
        contentType: 'application/json',
        status: 503,
      })
    })
    await page.locator(selectors.annotationInput).fill('Retained annotation')
    await page.locator(selectors.annotationSubmit).click()
    await expect(page.locator(selectors.annotationInput)).toHaveValue('Retained annotation')
    await expect(page.locator('#annotation-error')).toBeVisible()
    await expect(page.locator(selectors.annotationInput)).toHaveAttribute('aria-describedby', 'annotation-error')
  })

  test('announces a stale SSE connection while retaining confirmed state', async ({ page }) => {
    await page.goto(`${SERVICE_ORIGIN}/session?token=phasewire-e2e-token&workflow=${WORKFLOW_ID}`)
    await page.route('**/api/updates', async (route) => route.abort())
    await page.goto(`/#workflow=${WORKFLOW_ID}`)

    await expect(page.locator(selectors.staleBanner)).toBeVisible()
    await expect(page.locator(selectors.liveAnnouncement)).toContainText('Live workflow updates paused')
    await expect(page.locator(selectors.reportCanvas)).toBeVisible()
  })
})

test.describe('offline fallback', () => {
  test('navigates reports while keeping current and viewed phases distinct', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator(selectors.offlineBanner)).toBeVisible()
    await expect(page.locator(selectors.phasePlan)).toHaveAttribute('aria-current', 'step')

    await page.locator(selectors.phaseReview).click()
    await expect(page.locator(selectors.reportTitle)).toContainText('Review')
    await expect(page.locator(selectors.phaseReview)).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator(selectors.phasePlan)).toHaveAttribute('aria-current', 'step')
    await expect(page.locator(selectors.mainReport)).toBeFocused()

    await page.locator(selectors.phaseReady).click()
    await expect(page.locator(selectors.authorizeDeployment)).toBeDisabled()
  })

  test('reflows at 320px, discloses the title, and supports RTL without overflow', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 760 })
    await page.goto('/')
    await page.locator(selectors.workflowTitleToggle).click()
    await expect(page.locator(selectors.workflowTitleDisclosure)).toHaveAttribute('open', '')

    await page.locator(selectors.directionToggle).click()
    await expect(page.locator(selectors.appShell)).toHaveAttribute('dir', 'rtl')
    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    )
    expect(hasHorizontalOverflow).toBe(false)
  })

  test('preserves the complete state explanation with reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    await expect(page.locator(selectors.reportTitle)).toBeVisible()
    await expect(page.locator(selectors.phaseExecute)).toBeVisible()
  })
})
