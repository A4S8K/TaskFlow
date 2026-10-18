# Supabase database CA

`supabase-root-2021.crt` is a public root certificate, not a password or private key.
Downloaded over verified HTTPS on 18 October 2026 from:

https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt

The location is published by Supabase's dashboard source:
https://github.com/supabase/supabase/blob/master/apps/studio/hooks/custom-content/custom-content.json

The downloaded certificate's DER SHA-256 is:

```text
807025ad50d4ed219d2c9c7d299c004f824eb00cf7f65afef607d07b72e6cafa
```

Subject/issuer: Supabase Root 2021 CA. Valid until 26 April 2031.

Use `sslmode=verify-full` and this certificate's actual filesystem path for
database connections. Hostname verification remains enabled. Changes to the
trusted root require verification against Supabase's current official source;
never replace it with a certificate taken from an unverified connection.
