// lib/facebook-publish.js — Facebook Page Reels + Video publish (Meta Graph API v21.0)
// Page Token (süresiz) ile aynı IG hesabını besler.

export async function publishFacebookReel(pageId, pageToken, videoUrl, description) {
  // 1) Initialize upload session
  const init = await fetch(`https://graph.facebook.com/v21.0/${pageId}/video_reels?upload_phase=start&access_token=${pageToken}`, {
    method: 'POST',
  });
  const initJson = await init.json();
  if (!init.ok || !initJson.video_id) {
    throw new Error(`FB reel init fail: ${JSON.stringify(initJson)}`);
  }
  const videoId = initJson.video_id;
  const uploadUrl = initJson.upload_url;

  // 2) Upload via URL (hosted file)
  const upload = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `OAuth ${pageToken}`,
      file_url: videoUrl,
    },
  });
  const uploadJson = await upload.json();
  if (!upload.ok || !uploadJson.success) {
    throw new Error(`FB upload fail: ${JSON.stringify(uploadJson)}`);
  }

  // 3) Publish
  const params = new URLSearchParams({
    access_token: pageToken,
    video_id: videoId,
    upload_phase: 'finish',
    video_state: 'PUBLISHED',
    description: description || '',
  });
  const finish = await fetch(`https://graph.facebook.com/v21.0/${pageId}/video_reels?${params.toString()}`, {
    method: 'POST',
  });
  const finishJson = await finish.json();
  if (!finish.ok || !finishJson.success) {
    throw new Error(`FB publish fail: ${JSON.stringify(finishJson)}`);
  }

  return { videoId, success: true };
}

// Foto post — tek görsel (feed'e). imageUrl public olmalı (Supabase storage / site).
export async function publishFacebookPhoto(pageId, pageToken, imageUrl, caption) {
  const params = new URLSearchParams({
    access_token: pageToken,
    url: imageUrl,
    caption: caption || '',
    published: 'true',
  });
  const r = await fetch(`https://graph.facebook.com/v21.0/${pageId}/photos`, { method: 'POST', body: params });
  const j = await r.json();
  if (!r.ok || !(j.id || j.post_id)) throw new Error(`FB photo post fail: ${JSON.stringify(j)}`);
  return { photoId: j.id, postId: j.post_id };
}

// Alternative: regular video post (not Reels)
export async function publishFacebookVideo(pageId, pageToken, videoUrl, description, title) {
  const params = new URLSearchParams({
    access_token: pageToken,
    file_url: videoUrl,
    description: description || '',
    title: title || '',
    published: 'true',
  });
  const r = await fetch(`https://graph.facebook.com/v21.0/${pageId}/videos`, {
    method: 'POST',
    body: params,
  });
  const j = await r.json();
  if (!r.ok || !j.id) {
    throw new Error(`FB video post fail: ${JSON.stringify(j)}`);
  }
  return { videoId: j.id };
}
