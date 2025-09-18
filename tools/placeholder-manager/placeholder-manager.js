// eslint-disable-next-line import/no-unresolved
import 'https://da.live/nx/public/sl/components.js';
// eslint-disable-next-line import/no-unresolved
import getStyle from 'https://da.live/nx/utils/styles.js';
// eslint-disable-next-line import/no-unresolved
import { LitElement, html, nothing } from 'da-lit';
import DA_SDK from 'https://da.live/nx/utils/sdk.js';
const { token } = await DA_SDK;

const style = await getStyle(import.meta.url);

class PlaceholderManager extends LitElement {
  static properties = {
    loading: { type: Boolean, state: true },
    error: { type: String, state: true },
    placeholderData: { type: Object, state: true },
    statusMessage: { type: String, state: true },
    statusType: { type: String, state: true }, // 'success', 'error', 'info'
    basePath: { type: String, state: true },
    collapsedSections: { type: Object, state: true },
  };

  constructor(props) {
    super(props);
    this.loading = true;
    this.error = null;
    this.placeholderData = {};
    this.statusMessage = '';
    this.statusType = 'info';
    this.collapsedSections = {}; // Track which sections are collapsed

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

      // First, get the list of types (directories) in .placeholders
      const typesUrl = this.addCacheBust(`https://admin.da.live/list${this.basePath}/.placeholders/`);
      const typesResponse = await fetch(typesUrl, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!typesResponse.ok) {
        throw new Error(`Failed to fetch placeholder types: ${typesResponse.status} ${typesResponse.statusText}`);
      }

      const typesData = await typesResponse.json();
      console.log('Types data:', typesData);

      // Parse types and then fetch regions for each type
      this.placeholderData = await this.parseAndFetchPlaceholderData(typesData);

      // Initialize collapsed state: all sections collapsed except "default"
      this.initializeCollapsedState();

      this.loading = false;
    } catch (err) {
      console.error('Error loading placeholder data:', err);
      this.error = err.message;
      this.loading = false;
    }
  }

  async parseAndFetchPlaceholderData(typesData) {
    const organized = {};

    // Process each item in the types data to find type directories
    const typePromises = typesData.map(async (item) => {
      if (item.path) {
        // Expected path structure: /<org>/<site>/.placeholders/<type>
        const pathParts = item.path.split('/');

        if (pathParts.length >= 4 && pathParts[pathParts.length - 2] === '.placeholders') {
          const type = pathParts[pathParts.length - 1];

          // Skip if it's not a directory or if it's the .placeholders directory itself
          if (type && type !== '.placeholders') {
            try {
              // Fetch regions (files) for this type
              const regionsUrl = this.addCacheBust(`https://admin.da.live/list${this.basePath}/.placeholders/${type}/`);
              const regionsResponse = await fetch(regionsUrl, {
                headers: {
                  'Authorization': `Bearer ${token}`
                }
              });

              if (regionsResponse.ok) {
                const regionsData = await regionsResponse.json();
                console.log(`Regions for type ${type}:`, regionsData);

                // Extract region names from the response
                const regions = regionsData
                  .filter(regionItem => regionItem.path)
                  .map(regionItem => {
                    const regionPathParts = regionItem.path.split('/');
                    return regionPathParts[regionPathParts.length - 1]; // Get the last part (region name)
                  })
                  .filter(region => region && region !== type); // Filter out empty or duplicate names

                return { type, regions };
              } else {
                console.warn(`Failed to fetch regions for type ${type}: ${regionsResponse.status}`);
                return { type, regions: [] };
              }
            } catch (err) {
              console.error(`Error fetching regions for type ${type}:`, err);
              return { type, regions: [] };
            }
          }
        }
      }
      return null;
    });

    // Wait for all type/region fetches to complete
    const typeResults = await Promise.all(typePromises);

    // Organize the results
    typeResults.forEach(result => {
      if (result && result.type) {
        organized[result.type] = result.regions.sort();
      }
    });

    return organized;
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

      // Process each type
      for (const type of Object.keys(this.placeholderData)) {
        console.log(`\n=== Processing type: ${type} ===`);

        // First, fetch the all.json file for this type
        const allPath = `${this.basePath}/.placeholders/${type}/all.json`;
        const allSourceUrl = this.addCacheBust(`https://admin.da.live/source${allPath}`);

        let baseData = null;
        try {
          const allResponse = await fetch(allSourceUrl, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

          if (allResponse.ok) {
            const allData = await allResponse.json();
            baseData = this.normalizeDataKeys(allData);
            console.log(`Base data from ${type}/all.json:`, allData);
          } else {
            console.warn(`No all.json found for type ${type}: ${allResponse.status}`);
            baseData = { data: [] }; // Start with empty data if no all.json
          }
        } catch (err) {
          console.error(`Error fetching all.json for type ${type}:`, err);
          baseData = { data: [] }; // Start with empty data on error
        }

        // Now process each region for this type
        const regions = this.placeholderData[type];

        for (const region of regions) {
          if (region === 'all.json') continue; // Skip all.json as we already processed it

          console.log(`\n--- Processing region: ${type}/${region} ---`);

          const regionPath = `${this.basePath}/.placeholders/${type}/${region}`;
          const regionSourceUrl = this.addCacheBust(`https://admin.da.live/source${regionPath}`);

          try {
            const regionResponse = await fetch(regionSourceUrl, {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });

            if (regionResponse.ok) {
              const regionData = await regionResponse.json();
              console.log(`Region data from ${type}/${region}:`, regionData);

              // Normalize regionData to use lowercase keys
              this.normalizeDataKeys(regionData);

              // Merge the data: start with base (all.json) and overlay region-specific values
              const mergedData = this.mergePlaceholderData(baseData, regionData);

              // Create sheet name
              const regionName = region.replace('.json', ''); // Remove .json extension
              const sheetName = regionName === 'global' ? type : (
                type === 'default' ? regionName :`${type}-${regionName}`
              );

              // Add to multi-sheet result
              multiSheetResult[sheetName] = {
                total: mergedData.total || mergedData.data?.length || 0,
                offset: 0,
                limit: mergedData.total || mergedData.data?.length || 0,
                data: mergedData.data || []
              };

              // Add sheet name to names array
              multiSheetResult[':names'].push(sheetName);

              console.log(`Added sheet "${sheetName}" with ${mergedData.data?.length || 0} items`);
            } else {
              console.error(`Failed to fetch ${type}/${region}: ${regionResponse.status} ${regionResponse.statusText}`);
              // Use base data if region fetch fails
              const regionName = region.replace('.json', '');
              const sheetName = type === 'default' ? regionName : `${type}-${regionName}`;

              multiSheetResult[sheetName] = {
                total: baseData.total || baseData.data?.length || 0,
                offset: 0,
                limit: baseData.total || baseData.data?.length || 0,
                data: baseData.data || []
              };

              multiSheetResult[':names'].push(sheetName);
            }
          } catch (err) {
            console.error(`Error fetching ${type}/${region}:`, err);
            // Use base data if region fetch fails
            const regionName = region.replace('.json', '');
            const sheetName = type === 'default' ? regionName : `${type}-${regionName}`;

            multiSheetResult[sheetName] = {
              total: baseData.total || baseData.data?.length || 0,
              offset: 0,
              limit: baseData.total || baseData.data?.length || 0,
              data: baseData.data || []
            };

            multiSheetResult[':names'].push(sheetName);
          }
        }
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

  async postPlaceholderData(multiSheetData) {
    try {
      console.log('\n=== POSTING TO ENDPOINT ===');
      this.statusMessage = 'Copying placeholder data...';
      this.statusType = 'info';

      const url = this.addCacheBust(`https://admin.da.live/source${this.basePath}/placeholders.json`);

      // Create FormData with the multi-sheet data
      const body = new FormData();
      body.append('data', new Blob([JSON.stringify(multiSheetData)], { type: 'application/json' }));

      // POST the data
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: body
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Successfully posted placeholder data:', result);
        this.statusMessage = 'Placeholder data successfully copied!';
        this.statusType = 'success';
      } else {
        console.error(`Failed to post placeholder data: ${response.status} ${response.statusText}`);
        this.statusMessage = `Failed to copy placeholder data: ${response.status} ${response.statusText}`;
        this.statusType = 'error';
      }
    } catch (err) {
      console.error('Error posting placeholder data:', err);
      this.statusMessage = `Error copying placeholder data: ${err.message}`;
      this.statusType = 'error';
    }
  }

  normalizeDataKeys(data) {
    // Normalize data array to use lowercase keys
    if (data && data.data && Array.isArray(data.data)) {
      data.data = data.data.map(item => {
        const normalizedItem = {};
        Object.keys(item).forEach(key => {
          const lowerKey = key.toLowerCase();
          normalizedItem[lowerKey] = item[key];
        });
        return normalizedItem;
      });
    }
    return data;
  }

  mergePlaceholderData(baseData, regionData) {
    // Create a deep copy of the base data
    const merged = JSON.parse(JSON.stringify(baseData));

    // Create a map of existing keys in base data for quick lookup
    const baseKeyMap = new Map();
    if (merged.data && Array.isArray(merged.data)) {
      merged.data.forEach(item => {
        if (item.key) {
          baseKeyMap.set(item.key, item);
        }
      });
    }

    // Merge region data
    if (regionData.data && Array.isArray(regionData.data)) {
      regionData.data.forEach(regionItem => {
        if (regionItem.key) {
          if (baseKeyMap.has(regionItem.key)) {
            // Update existing key with region value
            const existingItem = baseKeyMap.get(regionItem.key);
            console.log(`  Overriding key "${regionItem.key}": "${existingItem.text}" -> "${regionItem.text}"`);
            existingItem.text = regionItem.text; // Override the text value
          } else {
            // Add new key from region
            merged.data.push(regionItem);
            baseKeyMap.set(regionItem.key, regionItem);
            console.log(`  Adding new key "${regionItem.key}": "${regionItem.text}"`);
          }
        }
      });
    }

    // Update metadata
    if (regionData[':colWidths']) {
      merged[':colWidths'] = regionData[':colWidths'];
    }
    if (regionData[':sheetname']) {
      merged[':sheetname'] = regionData[':sheetname'];
    }
    if (regionData[':type']) {
      merged[':type'] = regionData[':type'];
    }

    // Sort data alphabetically by key
    if (merged.data && Array.isArray(merged.data)) {
      merged.data.sort((a, b) => {
        const keyA = a.key || '';
        const keyB = b.key || '';
        return keyA.localeCompare(keyB);
      });
    }

    // Update total count
    merged.total = merged.data ? merged.data.length : 0;

    return merged;
  }

  postProcessMultiSheet(multiSheetData) {
    console.log('\n=== POST-PROCESSING MULTI-SHEET ===');

    // Create a deep copy to avoid modifying the original
    const result = JSON.parse(JSON.stringify(multiSheetData));

    // Special case: Merge "banner" with "default" (banner overwrites duplicate keys)
    if (result.banner && result.default) {
      console.log('Merging banner with default (banner overwrites)...');
      const mergedDefault = this.mergePlaceholderData(result.default, result.banner);
      result.default = mergedDefault;

      // Remove the banner sheet since it's now merged into default
      delete result.banner;
      result[':names'] = result[':names'].filter(name => name !== 'banner');

      console.log(`Merged banner into default. Default now has ${mergedDefault.data?.length || 0} items.`);
    }

    // Normal case: Merge each region with its corresponding "banner-region"
    // Find all banner-* sheets and their corresponding region sheets
    const bannerSheets = result[':names'].filter(name => name.startsWith('banner-'));

    bannerSheets.forEach(bannerSheetName => {
      // Extract region name from banner sheet (e.g., "banner-uae" -> "uae")
      const regionName = bannerSheetName.replace('banner-', '');

      // Check if corresponding region sheet exists
      if (result[regionName]) {
        console.log(`Merging ${bannerSheetName} with ${regionName} (banner overwrites)...`);
        const mergedRegion = this.mergePlaceholderData(result[regionName], result[bannerSheetName]);
        result[regionName] = mergedRegion;

        // Remove the banner sheet since it's now merged
        delete result[bannerSheetName];
        result[':names'] = result[':names'].filter(name => name !== bannerSheetName);

        console.log(`Merged ${bannerSheetName} into ${regionName}. ${regionName} now has ${mergedRegion.data?.length || 0} items.`);
      } else {
        console.log(`Warning: Found ${bannerSheetName} but no corresponding ${regionName} sheet to merge with.`);
      }
    });

    console.log('Post-processing complete. Final sheet names:', result[':names']);
    return result;
  }

  initializeCollapsedState() {
    const types = Object.keys(this.placeholderData);
    const newCollapsedState = {};

    types.forEach(type => {
      // All sections collapsed except "default"
      newCollapsedState[type] = type !== 'default';
    });

    this.collapsedSections = newCollapsedState;
  }

  toggleSection(type) {
    this.collapsedSections = {
      ...this.collapsedSections,
      [type]: !this.collapsedSections[type]
    };
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
        <p>Manage placeholder files organized by type and region:</p>

        <div class="file-list">
          ${types.map(type => html`
            <div class="type-section">
              <div class="type-header" @click=${() => this.toggleSection(type)}>
                <span class="type-title">${type}</span>
                <span class="collapse-icon ${this.collapsedSections[type] ? 'collapsed' : 'expanded'}">
                  ▼
                </span>
              </div>
              <div class="region-list ${this.collapsedSections[type] ? 'collapsed' : ''}">
                ${this.placeholderData[type].map(region => html`
                  <div class="region-item">
                    <span class="region-name">${region}</span>
                    <a
                      href="${this.generateEditorLink(type, region)}"
                      target="_blank"
                      class="editor-link"
                    >
                      Open in Editor
                    </a>
                  </div>
                `)}
              </div>
            </div>
          `)}
        </div>

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

customElements.define('placeholder-manager', PlaceholderManager);
