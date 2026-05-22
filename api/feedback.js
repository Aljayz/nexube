const https = require('https');

const GITHUB_OWNER = 'Aljayz';
const GITHUB_REPO = 'nexube';

const ISSUE_LABELS = {
  'Bug Report': 'bug-report',
  'Performance Issue': 'performance-issue',
  'Data & Sync': 'data-sync',
  'Feature Request': 'feature-request',
  'Improvement': 'improvement',
  'Design & UX': 'design-ux',
};

module.exports = async (req, res) => {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle Preflight Request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { issueType, title, description, platform, appVersion } = req.body || {};

    if (!issueType || !title || !title.trim()) {
      return res.status(400).json({ error: 'Missing required fields: issueType, title' });
    }

    if (!ISSUE_LABELS[issueType]) {
      return res.status(400).json({ error: `Invalid issue type: ${issueType}` });
    }

    const label = ISSUE_LABELS[issueType];
    const envInfo = [
      '**Environment:**',
      `- OS: ${platform || 'Unknown'}`,
      `- App Version: ${appVersion || 'Unknown'}`,
    ].join('\n');

    const body = [
      description || '*No description provided*',
      '',
      '---',
      '',
      envInfo,
    ].join('\n');

    const githubBody = JSON.stringify({
      title: `${issueType} - ${title.trim()}`,
      body,
      labels: [label, 'feedback'],
    });

    const options = {
      hostname: 'api.github.com',
      path: `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'nexube-feedback-proxy',
        'Accept': 'application/vnd.github.v3+json',
      },
    };

    const githubRes = await new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      });
      req.on('error', reject);
      req.write(githubBody);
      req.end();
    });

    if (githubRes.status === 201) {
      return res.status(201).json({ success: true, issue: JSON.parse(githubRes.body).html_url });
    }

    const errMsg = (() => {
      try { return JSON.parse(githubRes.body).message; } catch { return githubRes.body; }
    })();
    console.error('GitHub API error:', githubRes.status, errMsg);
    return res.status(githubRes.status).json({ error: 'Failed to create GitHub issue' });
  } catch (err) {
    console.error('Feedback proxy error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
