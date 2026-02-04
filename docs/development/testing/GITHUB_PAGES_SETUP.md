# GitHub Pages Setup for Test Dashboard

This guide explains how to set up GitHub Pages to host your test dashboard and reports publicly.

## 🚀 Quick Setup

### 1. Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** tab
3. Scroll down to **Pages** section (or click **Pages** in the left sidebar)
4. Under **Source**, select **GitHub Actions**
5. Click **Save**

### 2. Configure Repository Settings

Ensure your repository has the necessary permissions:

1. Go to **Settings** → **Actions** → **General**
2. Under **Workflow permissions**, select **Read and write permissions**
3. Check **Allow GitHub Actions to create and approve pull requests**
4. Click **Save**

### 3. Update Repository URL

Replace `yourusername` in the README.md with your actual GitHub username:

```markdown
- **[Test Dashboard](https://YOUR_USERNAME.github.io/newsletterHub/test-dashboard/)**
- **[Coverage Report](https://YOUR_USERNAME.github.io/newsletterHub/html/)**
- **[Test Results](https://YOUR_USERNAME.github.io/newsletterHub/test-results/)**
```

## 📋 Available Workflows

### Option 1: Automatic Deployment (Recommended)

The `deploy-dashboard.yml` workflow automatically deploys on:
- Push to `main` or `develop` branches
- Pull requests
- After test suite completion

### Option 2: Manual Deployment

The `pages.yml` workflow can be triggered manually:
1. Go to **Actions** tab
2. Select **Deploy to GitHub Pages** workflow
3. Click **Run workflow**
4. Select branch and click **Run workflow**

## 🔗 Dashboard URLs

Once deployed, your dashboard will be available at:

- **Main Dashboard**: `https://YOUR_USERNAME.github.io/newsletterHub/test-dashboard/`
- **Coverage Report**: `https://YOUR_USERNAME.github.io/newsletterHub/html/`
- **Test Results**: `https://YOUR_USERNAME.github.io/newsletterHub/test-results/`

## 📱 PR Integration

When you create a pull request, the test workflow will automatically:
1. Run tests and generate reports
2. Comment on the PR with dashboard links
3. Upload artifacts for download

Example PR comment:
```
## Test Results Dashboard ✅

### Summary
- Tests: 15 total, 0 failed, 0 errors
- Coverage: 45% statements, 52% branches

### 📊 View Reports
- [Test Dashboard](https://yourusername.github.io/newsletterHub/test-dashboard/)
- [Coverage Report](https://yourusername.github.io/newsletterHub/html/)
- [Test Results](https://yourusername.github.io/newsletterHub/test-results/)
```

## 🛠️ Troubleshooting

### Dashboard Not Loading

1. **Check GitHub Pages Status**:
   - Go to **Settings** → **Pages**
   - Verify deployment status
   - Check for any error messages

2. **Check Actions Logs**:
   - Go to **Actions** tab
   - Find the latest deployment workflow
   - Check for any build errors

3. **Verify File Structure**:
   Ensure these files exist in your repository:
   ```
   test-dashboard/index.html
   html/index.html
   test-results/test-results.html
   ```

### Permission Issues

If you see permission errors:
1. Go to **Settings** → **Actions** → **General**
2. Ensure **Workflow permissions** is set to **Read and write permissions**
3. Check that **Allow GitHub Actions to create and approve pull requests** is enabled

### Custom Domain (Optional)

To use a custom domain:
1. Go to **Settings** → **Pages**
2. Under **Custom domain**, enter your domain
3. Add a CNAME record pointing to `YOUR_USERNAME.github.io`
4. Check **Enforce HTTPS** if desired

## 🔄 Manual Deployment

To manually trigger a deployment:

```bash
# Via GitHub CLI
gh workflow run deploy-dashboard.yml

# Or via GitHub UI
# 1. Go to Actions tab
# 2. Select "Deploy Test Dashboard to GitHub Pages"
# 3. Click "Run workflow"
```

## 📊 Monitoring

### Check Deployment Status

1. **GitHub Pages**: Settings → Pages → View deployment status
2. **Actions**: Actions tab → View workflow runs
3. **Repository**: Check for `gh-pages` branch (if using branch deployment)

### View Analytics

GitHub Pages provides basic analytics:
1. Go to **Settings** → **Pages**
2. Scroll down to **Traffic** section
3. View page views and referrers

## 🔒 Security Considerations

### Public Access

- GitHub Pages sites are publicly accessible
- Consider if you want test results to be public
- Use private repositories if sensitive information is included

### Rate Limiting

- GitHub Pages has rate limits for builds
- Avoid excessive deployments
- Use caching where possible

## 🎯 Best Practices

1. **Regular Updates**: Deploy dashboard after each test run
2. **Clean URLs**: Use descriptive URLs in your README
3. **Documentation**: Keep this guide updated
4. **Monitoring**: Check deployment status regularly
5. **Backup**: Keep local copies of important reports

## 📞 Support

If you encounter issues:

1. Check GitHub Pages documentation
2. Review Actions workflow logs
3. Verify repository permissions
4. Check for common issues in this guide

---

Your test dashboard will now be automatically deployed and accessible to anyone with the URL! 