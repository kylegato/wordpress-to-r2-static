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
  
    // Check if there's a redirect for this path
    const redirect = await REDIRECTS.get(cacheKey, { type: "json" })
    if (redirect) {
      debug(`Redirect found for: ${cacheKey}`)
      return Response.redirect(redirect.target, redirect.type)
    }
  
    // Check if the content is already cached in R2
    const cachedResponse = await MY_BUCKET.get(cacheKey)
    if (cachedResponse) {
      debug(`Cache hit for: ${cacheKey}`)
      const headers = new Headers({
        'Content-Type': cachedResponse.httpMetadata.contentType,
        'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
      })
      return new Response(cachedResponse.body, { headers })
    }
  
    debug(`Cache miss for: ${cacheKey}`)
  
    // If not cached, fetch from the origin server (WordPress)
    if (WORDPRESS_BACKEND_ENABLED) {
      try {
        const originResponse = await fetch(request)
  
        // Handle redirects
        if (originResponse.redirected) {
          const redirectUrl = originResponse.url
          const redirectType = originResponse.status
          debug(`New redirect detected for: ${cacheKey}`)
          event.waitUntil(REDIRECTS.put(cacheKey, JSON.stringify({
            target: redirectUrl,
            type: redirectType
          })))
          return Response.redirect(redirectUrl, redirectType)
        }
  
        const content = await originResponse.arrayBuffer()
  
        // Cache all successful responses
        if (originResponse.ok) {
          debug(`Caching content for: ${cacheKey}`)
          event.waitUntil(MY_BUCKET.put(cacheKey, content, {
            httpMetadata: { contentType: originResponse.headers.get('Content-Type') }
          }))
        }
  
        const headers = new Headers(originResponse.headers)
        headers.set('Cache-Control', 'public, max-age=3600') // Cache for 1 hour
  
        return new Response(content, {
          status: originResponse.status,
          headers: headers
        })
      } catch (error) {
        console.error(`Fetch error for ${cacheKey}:`, error)
        return new Response('An error occurred', { status: 500 })
      }
    }
  
    // If WordPress backend is disabled and content is not in R2, return 404
    debug(`Content not found for: ${cacheKey}`)
    return new Response('Not Found', { status: 404 })
  }