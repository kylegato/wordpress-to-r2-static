addEventListener('fetch', event => {
  event.respondWith(handleRequest(event))
})

async function handleRequest(event) {
  const request = event.request
  const url = new URL(request.url)
  const cacheKey = url.hostname + url.pathname + url.search

  const debug = (msg) => {
    if (WORKER_DEBUG) {
      console.log(msg)
    }
  }

  debug(`Handling request for: ${cacheKey}`)

  // Check if the request is for a non-cacheable path
  if (shouldNotCache(url.pathname)) {
    debug(`Not caching: ${cacheKey}`)
    return fetch(request)
  }

  // Check if there's a redirect for this path
  debug(`Checking for redirect in KV for: ${cacheKey}`)
  let redirect
  try {
    redirect = await REDIRECTS.get(cacheKey, { type: "json" })
    debug(`KV get result for ${cacheKey}: ${JSON.stringify(redirect)}`)
  } catch (error) {
    debug(`Error retrieving redirect for ${cacheKey}: ${error}`)
  }

  if (redirect) {
    debug(`Redirect found for: ${cacheKey}. Redirecting to: ${redirect.target}`)
    return Response.redirect(redirect.target, redirect.type)
  } else {
    debug(`No redirect found for: ${cacheKey}`)
  }

  // Check if the content is already cached in R2
  try {
    const cachedResponse = await MY_BUCKET.get(cacheKey)
    if (cachedResponse) {
      debug(`Cache hit for: ${cacheKey}`)
      const headers = new Headers({
        'Content-Type': cachedResponse.httpMetadata.contentType,
        'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
      })
      return new Response(cachedResponse.body, { headers })
    }
  } catch (error) {
    debug(`Error retrieving from R2 for ${cacheKey}: ${error}`)
    // Continue execution, as we'll fetch from origin if R2 retrieval fails
  }

  debug(`Cache miss for: ${cacheKey}`)

  // If not cached, fetch from the origin server (WordPress)
  if (WORDPRESS_BACKEND_ENABLED) {
    try {
      debug(`Fetching from origin for: ${cacheKey}`)
      const originResponse = await fetch(request)

      // Handle redirects
      if (originResponse.redirected) {
        const redirectUrl = originResponse.url
        const redirectType = originResponse.status
        debug(`New redirect detected for: ${cacheKey}. Redirecting to: ${redirectUrl}`)
        try {
          const redirectData = JSON.stringify({
            target: redirectUrl,
            type: redirectType
          })
          debug(`Storing redirect in KV for ${cacheKey}: ${redirectData}`)
          await REDIRECTS.put(cacheKey, redirectData)
          debug(`Redirect stored successfully for: ${cacheKey}`)
        } catch (error) {
          debug(`Error storing redirect for ${cacheKey}: ${error}`)
        }
        return Response.redirect(redirectUrl, redirectType)
      }

      // If not a redirect, check if it's a 301 or 302 status code
      if (originResponse.status === 301 || originResponse.status === 302) {
        const redirectUrl = originResponse.headers.get('Location')
        const redirectType = originResponse.status
        debug(`New redirect (${redirectType}) detected for: ${cacheKey}. Redirecting to: ${redirectUrl}`)
        try {
          const redirectData = JSON.stringify({
            target: redirectUrl,
            type: redirectType
          })
          debug(`Storing redirect in KV for ${cacheKey}: ${redirectData}`)
          await REDIRECTS.put(cacheKey, redirectData)
          debug(`Redirect stored successfully for: ${cacheKey}`)
        } catch (error) {
          debug(`Error storing redirect for ${cacheKey}: ${error}`)
        }
        return Response.redirect(redirectUrl, redirectType)
      }

      const content = await originResponse.arrayBuffer()

      // Cache all successful responses for cacheable paths
      if (originResponse.ok && !shouldNotCache(url.pathname)) {
        debug(`Caching content for: ${cacheKey}`)
        try {
          await MY_BUCKET.put(cacheKey, content, {
            httpMetadata: { contentType: originResponse.headers.get('Content-Type') }
          })
        } catch (error) {
          debug(`Error storing content in R2 for ${cacheKey}: ${error}`)
          // Continue execution, as we can still return the response even if caching fails
        }
      }

      const headers = new Headers(originResponse.headers)
      headers.set('Cache-Control', 'public, max-age=3600') // Cache for 1 hour

      return new Response(content, {
        status: originResponse.status,
        headers: headers
      })
    } catch (error) {
      debug(`Fetch error for ${cacheKey}: ${error}`)
      return new Response('An error occurred', { status: 500 })
    }
  }

  // If WordPress backend is disabled and content is not in R2, return 404
  debug(`Content not found for: ${cacheKey}`)
  return new Response('Not Found', { status: 404 })
}

function shouldNotCache(pathname) {
  const nonCacheablePaths = [
    '/wp-admin',
    '/wp-login.php',
    '/wp-json',
    '/xmlrpc.php',
    '/wp-cron.php',
    '/wp-comments-post.php'
  ]
  return nonCacheablePaths.some(path => pathname.startsWith(path))
}
