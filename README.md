# WordPress to R2 Static Site Worker

Convert your WordPress site to a static site by caching it in Cloudflare R2 over time. This project uses Cloudflare Workers to gradually build a static backup of your WordPress site, allowing you to switch to a fully static version when ready.

## Features

- Gradually cache your WordPress site content in Cloudflare R2
- Cache all types of content, including HTML, CSS, JavaScript, images, and more
- Seamlessly serve cached content while still allowing access to the WordPress backend
- Easy switch to fully static mode by disabling WordPress backend access
- Works with any Cloudflare-proxied (orange-clouded) WordPress site, including subpath installations
- Handles and caches redirects using Cloudflare KV, maintaining functionality even in static mode
- Supports multiple domains with domain-specific caching
- Graceful error handling for network issues
- Debug mode for troubleshooting

## Setup Instructions

1. Ensure your WordPress site/domain record (yourdomain.com/blog/ (yourdomain.com) or blog.yourdomain.com (blog.yourdomain.com) would be two different records) is proxied through Cloudflare (orange-clouded)
2. Clone this repository
3. Install [Wrangler CLI](https://developers.cloudflare.com/workers/cli-wrangler/install-update)
4. Create a KV namespace for redirects in your Cloudflare account
5. Configure your `wrangler.toml` file (see example below)
6. Deploy the worker using `wrangler publish`

## Configuration

Edit the `wrangler.toml` file to include your specific settings. Here's an example configuration:

### Configuration Options

| Option | Description | User Action |
|--------|-------------|-------------|
| `name` | The name of your worker | Change to your preferred worker name |
| `main` | The main script file for your worker | Leave as is unless you change the file structure |
| `compatibility_date` | The compatibility date for the worker | Update to the current date when deploying |
| `WORDPRESS_BACKEND_ENABLED` | Whether to fetch from WordPress if content is not in R2 | Set to `false` when ready to serve only static content |
| `WORKER_DEBUG` | Enable or disable debug logging | Set to `true` to enable debug logs, `false` to disable |
| `bucket_name` | The name of your R2 bucket for storing static content | Replace with your actual R2 bucket name |
| `binding` (for r2_buckets) | The variable name used in the worker to access the R2 bucket | Leave as "MY_BUCKET" unless you change it in the worker code |
| `binding` (for kv_namespaces) | The variable name used in the worker to access the KV namespace | Leave as "REDIRECTS" unless you change it in the worker code |
| `id` (for kv_namespaces) | The ID of your KV namespace for storing redirects | Replace with your actual KV namespace ID |
| `pattern` | The URL pattern for which this worker should run | Replace with your domain and adjust if using a subpath |
| `zone_name` | The domain name for which this worker should run | Replace with your actual domain name |

Make sure to replace the placeholder values (like `your-static-site-bucket`, `your-kv-namespace-id`, and `example.com`) with your actual values before deploying.

## Wrangler Commands

Before configuring your `wrangler.toml` file, you'll need to create a KV namespace for redirects and an R2 bucket for storing static content. Here are the commands to do so:

### Create KV Namespace

To create a KV namespace for storing redirects:

```
wrangler kv namespace create "REDIRECTS"
```
🌀 Creating namespace with title "worker-REDIRECTS"
✨ Success!
Add the following to your configuration file in your kv_namespaces array:
{ binding = "REDIRECTS", id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" }

Make note of the `id` value, as you'll need it for your `wrangler.toml` configuration.

### Create R2 Bucket

To create an R2 bucket for storing static content:

```bash
wrangler r2 bucket create your-static-site-bucket
```

Replace `your-static-site-bucket` with your desired bucket name. This command will create the bucket and confirm its creation.

### List R2 Buckets

If you need to list your R2 buckets:

```bash
wrangler r2 bucket list
```

This will show you all your R2 buckets, which can be helpful if you need to reference the correct bucket name.

### Configuring wrangler.toml

After creating your KV namespace and R2 bucket, update your `wrangler.toml` file with the information obtained from the above commands:

1. Replace `your-kv-namespace-id` with the `id` value from the KV namespace creation output.
2. Replace `your-static-site-bucket` with the name of the R2 bucket you created.

For example:

```toml
[[kv_namespaces]]
binding = "REDIRECTS"
id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

[[r2_buckets]]
binding = "MY_BUCKET"
bucket_name = "your-static-site-bucket"
```

Make sure to also update the `routes` and `zone_name` in the `[triggers]` section with your actual domain information.
