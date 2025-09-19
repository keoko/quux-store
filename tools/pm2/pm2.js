// eslint-disable-next-line import/no-unresolved
import 'https://da.live/nx/public/sl/components.js';
// eslint-disable-next-line import/no-unresolved
import getStyle from 'https://da.live/nx/utils/styles.js';
// eslint-disable-next-line import/no-unresolved
import { LitElement, html, nothing } from 'da-lit';
import DA_SDK from 'https://da.live/nx/utils/sdk.js';
const { token } = await DA_SDK;

const style = await getStyle(import.meta.url);

class PM2 extends LitElement {
  static properties = {
    loading: { type: Boolean, state: true },
    error: { type: String, state: true },
    placeholderData: { type: Object, state: true },
    multisheetData: { type: Object, state: true },
    statusMessage: { type: String, state: true },
    statusType: { type: String, state: true }, // 'success', 'error', 'info'
    basePath: { type: String, state: true },
  };

  constructor(props) {
    super(props);
    this.loading = true;
    this.error = null;
    this.placeholderData = {};
    this.multisheetData = null;
    this.statusMessage = '';
    this.statusType = 'info';

    // Initialize basePath from window query parameter, default to /hannessolo/da-playground
    const urlParams = new URLSearchParams(window.location.search);
    this.basePath = urlParams.get('basePath') || '/hannessolo/da-playground';

    // Extract org, site, and folders from basePath for reuse in URL building
    const pathParts = this.basePath.split('/').filter(part => part);
    this.org = pathParts[0];
    this.site = pathParts[1];
    this.folders = pathParts.slice(2).join('/');
  }

  addCacheBust(url) {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}cacheBust=${Math.random().toString(36).substring(7)}`;
  }

  buildPlaceholdersAdminUrl(mode = 'preview') {
    const foldersPath = this.folders ? `/${this.folders}` : '';
    return `https://admin.hlx.page/${mode}/${this.org}/${this.site}/main${foldersPath}/placeholders.json`;
  }

  buildPlaceholdersUrl(mode = 'preview') {
    const foldersPath = this.folders ? `/${this.folders}` : '';
    if (mode === 'preview') {
      return `https://main--${this.site}--${this.org}.aem.page${foldersPath}/placeholders.json`;
    } else {
      return `https://main--${this.site}--${this.org}.aem.live${foldersPath}/placeholders.json`;
    }
  }

  async connectedCallback() {
    super.connectedCallback();
    this.shadowRoot.adoptedStyleSheets = [style];
    await this.loadPlaceholderData();
  }

  async loadPlaceholderData() {
    try {
      this.loading = true;
      this.error = null;

      // First, get the data from placeholders-raw
      const placeholdersRawUrl = this.addCacheBust(`https://admin.da.live/source${this.basePath}/placeholders-raw.json`);
      const placeholdersRawResponse = await fetch(placeholdersRawUrl, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!placeholdersRawResponse.ok) {
        throw new Error(`Failed to fetch placeholders raw data: ${placeholdersRawResponse.status} ${placeholdersRawResponse.statusText}`);
      }

      this.placeholderData = await placeholdersRawResponse.json();
      console.log('Placeholders raw data:', this.placeholderData);

      this.loading = false;
    } catch (err) {
      console.error('Error loading placeholders raw data:', err);
      this.error = err.message;
      this.loading = false;
    }
  }

  generateEditorLink(type, region) {
    // remove extension from region
    const regionWithoutExtension = region.replace(/\.[^/.]+$/, '');
    // Editor links are always like da.live/sheet#<path>
    const path = `${this.basePath}/.placeholders/${type}/${regionWithoutExtension}`;
    return `https://da.live/sheet#${path}`;
  }

  handleViewResult() {
    const url = `https://da.live/sheet#${this.basePath}/placeholders`;
    window.open(url, '_blank');
  }

  handleViewMultisheet() {
    const url = `https://da.live/sheet#${this.basePath}/placeholders-multisheet`;
    window.open(url, '_blank');
  }

  async handlePreview() {
    try {
      this.statusMessage = 'Publishing to preview...';
      this.statusType = 'info';

      const url = this.buildPlaceholdersAdminUrl('preview');

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        this.statusMessage = 'Successfully published to preview!';
        this.statusType = 'success';

        // Open the preview URL
        const previewUrl = this.buildPlaceholdersUrl('preview');
        window.open(previewUrl, '_blank');
      } else {
        this.statusMessage = `Failed to publish to preview: ${response.status} ${response.statusText}`;
        this.statusType = 'error';
      }
    } catch (err) {
      console.error('Error publishing to preview:', err);
      this.statusMessage = `Error publishing to preview: ${err.message}`;
      this.statusType = 'error';
    }
  }

  async handlePublish() {
    try {
      this.statusMessage = 'Publishing to live...';
      this.statusType = 'info';

      const url = this.buildPlaceholdersAdminUrl('live');

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        this.statusMessage = 'Successfully published to live!';
        this.statusType = 'success';

        // Open the live URL
        const liveUrl = this.buildPlaceholdersUrl('live');
        window.open(liveUrl, '_blank');
      } else {
        this.statusMessage = `Failed to publish to live: ${response.status} ${response.statusText}`;
        this.statusType = 'error';
      }
    } catch (err) {
      console.error('Error publishing to live:', err);
      this.statusMessage = `Error publishing to live: ${err.message}`;
      this.statusType = 'error';
    }
  }

  getTypes() {
    if (!this.placeholderData || !this.placeholderData[':names']) {
      return [];
    }

    const types = new Set();

    for (const name of this.placeholderData[':names']) {
      // Extract type from format "type-region" or "type-all"
      const parts = name.split('-');
      if (parts.length >= 2) {
        // Join all parts except the last one to handle types with hyphens
        const type = parts.slice(0, -1).join('-');
        types.add(type);
      }
    }

    return Array.from(types);
  }


  async handleCopy() {
    console.log('Copy button clicked');
    this.statusMessage = 'Processing placeholder data...';
    this.statusType = 'info';

    try {
      const multiSheetResult = {
        ':version': 3,
        ':names': [],
        ':type': 'multi-sheet'
      };

      const types = getTypes();
      // Process each type
      for (const type of types) {
        console.log(`\n=== Processing type: ${type} ===`);

        // // First, fetch the all.json file for this type
        // const allPath = `${this.basePath}/.placeholders/${type}/all.json`;
        // const allSourceUrl = this.addCacheBust(`https://admin.da.live/source${allPath}`);

        // let baseData = null;
        // try {
        //   const allResponse = await fetch(allSourceUrl, {
        //     headers: {
        //       'Authorization': `Bearer ${token}`
        //     }
        //   });

        //   if (allResponse.ok) {
        //     const allData = await allResponse.json();
        //     baseData = this.normalizeDataKeys(allData);
        //     console.log(`Base data from ${type}/all.json:`, allData);
        //   } else {
        //     console.warn(`No all.json found for type ${type}: ${allResponse.status}`);
        //     baseData = { data: [] }; // Start with empty data if no all.json
        //   }
        // } catch (err) {
        //   console.error(`Error fetching all.json for type ${type}:`, err);
        //   baseData = { data: [] }; // Start with empty data on error
        // }

        // // Now process each region for this type
        // const regions = this.placeholderData[type];

        // for (const region of regions) {
        //   if (region === 'all.json') continue; // Skip all.json as we already processed it

        //   console.log(`\n--- Processing region: ${type}/${region} ---`);

        //   const regionPath = `${this.basePath}/.placeholders/${type}/${region}`;
        //   const regionSourceUrl = this.addCacheBust(`https://admin.da.live/source${regionPath}`);

        //   try {
        //     const regionResponse = await fetch(regionSourceUrl, {
        //       headers: {
        //         'Authorization': `Bearer ${token}`
        //       }
        //     });

        //     if (regionResponse.ok) {
        //       const regionData = await regionResponse.json();
        //       console.log(`Region data from ${type}/${region}:`, regionData);

        //       // Normalize regionData to use lowercase keys
        //       this.normalizeDataKeys(regionData);

        //       // Merge the data: start with base (all.json) and overlay region-specific values
        //       const mergedData = this.mergePlaceholderData(baseData, regionData);

        //       // Create sheet name
        //       const regionName = region.replace('.json', ''); // Remove .json extension
        //       const sheetName = regionName === 'global' ? type : (
        //         type === 'default' ? regionName :`${type}-${regionName}`
        //       );

        //       // Add to multi-sheet result
        //       multiSheetResult[sheetName] = {
        //         total: mergedData.total || mergedData.data?.length || 0,
        //         offset: 0,
        //         limit: mergedData.total || mergedData.data?.length || 0,
        //         data: mergedData.data || []
        //       };

        //       // Add sheet name to names array
        //       multiSheetResult[':names'].push(sheetName);

        //       console.log(`Added sheet "${sheetName}" with ${mergedData.data?.length || 0} items`);
        //     } else {
        //       console.error(`Failed to fetch ${type}/${region}: ${regionResponse.status} ${regionResponse.statusText}`);
        //       // Use base data if region fetch fails
        //       const regionName = region.replace('.json', '');
        //       const sheetName = type === 'default' ? regionName : `${type}-${regionName}`;

        //       multiSheetResult[sheetName] = {
        //         total: baseData.total || baseData.data?.length || 0,
        //         offset: 0,
        //         limit: baseData.total || baseData.data?.length || 0,
        //         data: baseData.data || []
        //       };

        //       multiSheetResult[':names'].push(sheetName);
        //     }
        //   } catch (err) {
        //     console.error(`Error fetching ${type}/${region}:`, err);
        //     // Use base data if region fetch fails
        //     const regionName = region.replace('.json', '');
        //     const sheetName = type === 'default' ? regionName : `${type}-${regionName}`;

        //     multiSheetResult[sheetName] = {
        //       total: baseData.total || baseData.data?.length || 0,
        //       offset: 0,
        //       limit: baseData.total || baseData.data?.length || 0,
        //       data: baseData.data || []
        //     };

        //     multiSheetResult[':names'].push(sheetName);
        //   }
        // }
      }

      console.log('\n=== BEFORE POST-PROCESSING ===');
      console.log('Multi-sheet placeholder data:', JSON.stringify(multiSheetResult, null, 2));

      // Apply post-processing to merge sheets according to the specified rules
      const postProcessedResult = this.postProcessMultiSheet(multiSheetResult);

      console.log('\n=== AFTER POST-PROCESSING ===');
      console.log('Post-processed multi-sheet data:', JSON.stringify(postProcessedResult, null, 2));

      // POST the data to the endpoint
      await this.postPlaceholderData(postProcessedResult);

    } catch (err) {
      console.error('Error in copy:', err);
      this.statusMessage = `Error: ${err.message}`;
      this.statusType = 'error';
    }
  }

  render() {
    if (this.loading) {
      return html`
        <div class="loading">
          <h1>Placeholder Manager</h1>
          <p class="org-site-info">Organization/Site: <strong>${this.basePath}</strong></p>
          <p>Loading placeholder files...</p>
        </div>
      `;
    }

    if (this.error) {
      return html`
        <div>
          <h1>Placeholder Manager</h1>
          <p class="org-site-info">Organization/Site: <strong>${this.basePath}</strong></p>
          <div class="error">
            <p>Error: ${this.error}</p>
            <button @click=${this.loadPlaceholderData} class="copy-publish-button" style="background: #dc3545; margin-top: 1rem;">
              Retry
            </button>
          </div>
        </div>
      `;
    }

    const types = Object.keys(this.placeholderData);

    if (types.length === 0) {
      return html`
        <div>
          <h1>Placeholder Manager</h1>
          <p class="org-site-info">Organization/Site: <strong>${this.basePath}</strong></p>
          <p>No placeholder files found in ${this.basePath}/.placeholders/</p>
        </div>
      `;
    }

    return html`
      <div class="ai-bot">
        <h1>Placeholder Manager</h1>
        <p class="org-site-info">Organization/Site: <strong>${this.basePath}</strong></p>
        <p>Manage placeholder files organized by type and region</p>

        <div class="button-group">
          <button
            @click=${this.handleCopy}
            class="copy-publish-button"
          >
            Copy
          </button>

          <button
            @click=${this.handleViewResult}
            class="view-result-button"
          >
            View Generated Placeholders
          </button>
        </div>

        <div class="button-group">
          <button
            @click=${this.handlePreview}
            class="preview-button"
          >
            Preview
          </button>

          <button
            @click=${this.handlePublish}
            class="publish-button"
          >
            Publish
          </button>
        </div>

        ${this.statusMessage ? html`
          <div class="status-message status-${this.statusType}">
            ${this.statusMessage}
          </div>
        ` : nothing}
      </div>
    `;
  }
}

customElements.define('pam-pam', PM2);
