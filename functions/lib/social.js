/**
 * functions/lib/social.js
 * Sosyal medya yayın adapter'ları — Buffer / Publer / Mock
 *
 * Env var SOCIAL_PROVIDER: 'buffer' | 'publer' | 'mock'  (default: 'mock')
 * Faz-1'de MockAdapter aktif. Gerçek adapter'lar TODO.
 *
 * Secrets (Secret Manager):
 *   BUFFER_API_KEY   — Buffer API access token
 *   PUBLER_API_KEY   — Publer API key
 */

const { logger } = require('firebase-functions');

// ---------------------------------------------------------------------------
// Platform constants
// ---------------------------------------------------------------------------
const PLATFORMS = ['youtube', 'instagram', 'facebook', 'twitter', 'tiktok'];

// ---------------------------------------------------------------------------
// Base interface (duck-typed)
// ---------------------------------------------------------------------------
class SocialAdapter {
  /**
   * @param {{ platform: string, text: string, image?: string, link?: string }} payload
   * @returns {Promise<{ success: boolean, postId?: string, url?: string, error?: string }>}
   */
  // eslint-disable-next-line no-unused-vars
  async publish(payload) {
    throw new Error('SocialAdapter.publish() must be implemented by subclass');
  }
}

// ---------------------------------------------------------------------------
// MockAdapter — always succeeds, returns fake IDs. Safe for Faz-1 testing.
// ---------------------------------------------------------------------------
class MockAdapter extends SocialAdapter {
  async publish({ platform, text }) {
    const fakeId = `mock_${platform}_${Date.now()}`;
    logger.info('[social:mock] publish', { platform, textLen: text?.length, fakeId });
    return {
      success: true,
      postId: fakeId,
      url:    `https://example.com/${platform}/${fakeId}`,
    };
  }
}

// ---------------------------------------------------------------------------
// BufferAdapter — TODO: implement after Secret Manager key is set
// Buffer API docs: https://buffer.com/developers/api
// ---------------------------------------------------------------------------
class BufferAdapter extends SocialAdapter {
  constructor(apiKey) {
    super();
    this.apiKey = apiKey;
  }

  async publish({ platform, text, image, link }) {
    // TODO: map 'platform' to Buffer profile_ids from config
    // TODO: POST https://api.bufferapp.com/1/updates/create.json
    //   { profile_ids, text, media: { link, picture } }
    // TODO: handle 403 (profile not connected) gracefully
    logger.warn('[social:buffer] Not yet implemented — returning stub', { platform });
    return {
      success: false,
      error: 'BufferAdapter not yet implemented. Set SOCIAL_PROVIDER=mock for testing.',
    };
  }
}

// ---------------------------------------------------------------------------
// PublerAdapter — TODO: implement after Secret Manager key is set
// Publer API docs: https://publer.io/api-docs
// ---------------------------------------------------------------------------
class PublerAdapter extends SocialAdapter {
  constructor(apiKey) {
    super();
    this.apiKey = apiKey;
  }

  async publish({ platform, text, image, link }) {
    // TODO: POST https://publer.io/api/v1/posts
    //   { platforms: [platform], content: text, link, media_urls: [image] }
    // TODO: handle TikTok — Publer supports TikTok but needs business account
    logger.warn('[social:publer] Not yet implemented — returning stub', { platform });
    return {
      success: false,
      error: 'PublerAdapter not yet implemented. Set SOCIAL_PROVIDER=mock for testing.',
    };
  }
}

// ---------------------------------------------------------------------------
// Factory — reads SOCIAL_PROVIDER env + secrets at call time (inside Function)
// ---------------------------------------------------------------------------
function createAdapter() {
  const provider = (process.env.SOCIAL_PROVIDER || 'mock').toLowerCase();

  if (provider === 'buffer') {
    const { defineSecret } = require('firebase-functions/params');
    const key = defineSecret('BUFFER_API_KEY').value();
    return new BufferAdapter(key);
  }

  if (provider === 'publer') {
    const { defineSecret } = require('firebase-functions/params');
    const key = defineSecret('PUBLER_API_KEY').value();
    return new PublerAdapter(key);
  }

  // Default: mock
  return new MockAdapter();
}

/**
 * publishToAll — publishes to all 5 platforms, collects results map.
 *
 * @param {{ text: string, image?: string, link?: string, summaryML?: object }} content
 * @param {string} traceId
 * @returns {Promise<{ results: object, successCount: number }>}
 */
async function publishToAll(content, traceId = 'no-trace') {
  const adapter = createAdapter();
  const results = {};

  // Platform-specific text trimming
  function textFor(platform) {
    if (platform === 'twitter') {
      // 280 char limit — prefer EN summary
      const base = content.summaryML?.en || content.text || '';
      return base.length > 280 ? base.substring(0, 277) + '...' : base;
    }
    // TR summary for other platforms (local audience)
    return content.summaryML?.tr || content.text || '';
  }

  await Promise.allSettled(
    PLATFORMS.map(async (platform) => {
      try {
        const res = await adapter.publish({
          platform,
          text:  textFor(platform),
          image: content.image  || null,
          link:  content.link   || null,
        });
        results[platform] = res;
        logger.info('[social] published', { traceId, platform, success: res.success });
      } catch (err) {
        results[platform] = { success: false, error: err.message };
        logger.error('[social] publish error', { traceId, platform, error: err.message });
      }
    })
  );

  const successCount = Object.values(results).filter(r => r.success).length;
  return { results, successCount };
}

module.exports = {
  SocialAdapter,
  MockAdapter,
  BufferAdapter,
  PublerAdapter,
  createAdapter,
  publishToAll,
  PLATFORMS,
};
