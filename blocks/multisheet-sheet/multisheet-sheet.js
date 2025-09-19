// eslint-disable-next-line import/no-unresolved
import 'https://da.live/nx/public/sl/components.js';
// eslint-disable-next-line import/no-unresolved
import getStyle from 'https://da.live/nx/utils/styles.js';
// eslint-disable-next-line import/no-unresolved
import { LitElement, html, nothing } from 'da-lit';

const style = await getStyle(import.meta.url);

class MultisheetSheet extends LitElement {
  static properties = {
    data: { type: Object, state: true },
    activeSheet: { type: String, state: true },
    loading: { type: Boolean, state: true },
    error: { type: String, state: true },
  };

  constructor() {
    super();
    this.data = null;
    this.activeSheet = null;
    this.loading = true;
    this.error = null;
  }

  async connectedCallback() {
    super.connectedCallback();
    this.shadowRoot.adoptedStyleSheets = [style];
    await this.loadData();
  }

  async loadData() {
    try {
      this.loading = true;
      this.error = null;

      // Get the data from the current URL or from a data attribute
      const dataSource = this.getAttribute('data-source') || window.location.href;

      // If it's a URL, fetch the data
      if (dataSource.startsWith('http')) {
        const response = await fetch(dataSource);
        if (!response.ok) {
          throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
        }
        this.data = await response.json();
      } else {
        // Assume it's already data
        this.data = JSON.parse(dataSource);
      }

      // Set the first sheet as active
      if (this.data && this.data[':names'] && this.data[':names'].length > 0) {
        this.activeSheet = this.data[':names'][0];
      }

      this.loading = false;
    } catch (err) {
      console.error('Error loading multisheet data:', err);
      this.error = err.message;
      this.loading = false;
    }
  }

  switchSheet(sheetName) {
    this.activeSheet = sheetName;
  }

  renderSheet(sheetName) {
    const sheetData = this.data[sheetName];
    if (!sheetData || !sheetData.data) {
      return html`<p>No data available for sheet: ${sheetName}</p>`;
    }

    const rows = sheetData.data;
    if (rows.length === 0) {
      return html`<p>No data in this sheet</p>`;
    }

    // Get headers from the first row
    const headers = Object.keys(rows[0]);

    return html`
      <div class="sheet-content">
        <div class="sheet-header">
          <h3>${sheetName}</h3>
          <span class="row-count">${rows.length} rows</span>
        </div>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                ${headers.map(header => html`<th>${header}</th>`)}
              </tr>
            </thead>
            <tbody>
              ${rows.map((row, index) => html`
                <tr>
                  ${headers.map(header => html`
                    <td>${row[header] || ''}</td>
                  `)}
                </tr>
              `)}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  render() {
    if (this.loading) {
      return html`
        <div class="loading">
          <h2>Multisheet Data</h2>
          <p>Loading data...</p>
        </div>
      `;
    }

    if (this.error) {
      return html`
        <div class="error">
          <h2>Multisheet Data</h2>
          <p>Error: ${this.error}</p>
        </div>
      `;
    }

    if (!this.data || !this.data[':names']) {
      return html`
        <div class="error">
          <h2>Multisheet Data</h2>
          <p>No multisheet data available</p>
        </div>
      `;
    }

    const sheetNames = this.data[':names'];

    return html`
      <div class="multisheet-container">
        <h2>Multisheet Data</h2>

        <div class="sheet-tabs">
          ${sheetNames.map(sheetName => html`
            <button
              class="sheet-tab ${this.activeSheet === sheetName ? 'active' : ''}"
              @click=${() => this.switchSheet(sheetName)}
            >
              ${sheetName}
            </button>
          `)}
        </div>

        <div class="sheet-content-container">
          ${this.activeSheet ? this.renderSheet(this.activeSheet) : nothing}
        </div>
      </div>
    `;
  }
}

customElements.define('multisheet-sheet', MultisheetSheet);
