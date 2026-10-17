# Application screenshots

PNG files in this folder are captured from the running TaskFlow application against PostgreSQL by Playwright, using actual smoke-test records. They are not design mockups or production customer data.

To regenerate, start the API and run from `frontend`:

```powershell
$env:CAPTURE_SCREENSHOTS='1'
npm.cmd run test:e2e
```

The suite creates uniquely named accounts/projects in the configured development database. Use a disposable environment.
