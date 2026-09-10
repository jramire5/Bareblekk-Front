import { expect, test } from "@playwright/test";

for (const signedIn of [false, true]) {
  test(`admin hydrates without a blank screen (${signedIn ? "signed in" : "signed out"})`, async ({ page }) => {
    const errors: string[] = [];
    const apiPaths: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    // Intercept before navigation: no request can reach the live backend.
    await page.route("**/*", async route => {
      const url = new URL(route.request().url());
      if (url.pathname.startsWith("/api/")) {
        apiPaths.push(url.pathname);
        if (url.pathname === "/api/v1/auth/me") {
          return route.fulfill({
            status: signedIn ? 200 : 401,
            json: signedIn
              ? { data: { id: "test-admin", name: "Test administrator", role: "ADMIN", email: "test@example.test" } }
              : { error: { code: "UNAUTHENTICATED", message: "Iniciar sesión." } },
          });
        }
        return route.fulfill({ json: { data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } } });
      }
      if (url.origin !== "http://localhost:5173") return route.abort();
      return route.continue();
    });

    await page.goto("/admin/");
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
    if (signedIn) {
      await expect(page.getByRole("heading", { name: /^Productos/ })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Todavía no hay productos" })).toBeVisible();
      await page.getByRole("link", { name: "Categorías", exact: true }).click();
      await expect(page.getByRole("heading", { name: /^Categorías/ })).toBeVisible();
    } else {
      await expect(page.getByRole("heading", { name: "Ingresá a tu espacio de trabajo" })).toBeVisible();
      await expect(page.getByLabel("Correo electrónico", { exact: true })).toBeVisible();
      await expect(page.getByLabel("Contraseña", { exact: true })).toBeVisible();
    }
    await expect(page.locator("astro-island")).not.toHaveAttribute("ssr", "");
    expect(apiPaths).toContain("/api/v1/auth/me");
    expect(errors).toEqual([]);
  });
}
