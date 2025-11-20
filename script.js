// Google Sheet CSV export URL
const GOOGLE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/1aIeL0PB-Zv87XWBWIA1JV2YSkFtBnD3TU9kGe5AMVBs/export?format=csv&gid=0';

const newsContainer = document.getElementById('news-container');
const loadingIndicator = document.getElementById('loading-indicator');
const errorMessage = document.getElementById('error-message');
const noResultsMessage = document.getElementById('no-results-message');

const filterContainerD = document.getElementById('filter-container-D');
const filterLoadingD = document.getElementById('filter-loading-D');
const filterContainerEF = document.getElementById('filter-container-EF');
const filterLoadingEF = document.getElementById('filter-loading-EF');

let articlesData = []; // Stores all fetched news articles
let selectedTagsD = new Set(); // Stores currently selected filter tags for Column D
let selectedTagsEF = new Set(); // Stores currently selected filter tags for Column E (formerly E & F)

/**
 * Parses CSV text into an array of objects, robustly handling commas within quoted fields.
 * Separates tags from Column D into `tagD` and from E into `tagsEF`.
 * @param {string} csvText - The raw CSV string.
 * @returns {Array<Object>} An array of objects, where each object represents a row.
 */
function parseCSV(csvText) {
    const lines = csvText.split('\n').filter(line => line.trim() !== '');
    if (lines.length === 0) return [];

    const data = [];
    const CSV_ROW_REGEX = /(?:^|,)(?:"([^"]*(?:""[^"]*)*)"|([^,]*))/g;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const values = [];
        let match;
        while ((match = CSV_ROW_REGEX.exec(line)) !== null) {
            let value = match[1] !== undefined ? match[1] : match[2];
            if (value !== undefined) {
                values.push(value.replace(/""/g, '"').trim());
            } else {
                values.push('');
            }
        }

        // Expecting at least 5 columns (A,B,C,D,E) for data we care about (indices 0 to 4)
        if (values.length >= 5) {
            const article = {
                imageLink: values[0],
                title: values[1],
                articleLink: values[2],
                tagD: values[3] ? values[3].trim() : '', // Tag from Column D
                tagsEF: [] // Tags from Column E
            };

            // Only add tag from column E (index 4)
            const E_INDEX = 4;
            if (values[E_INDEX] && values[E_INDEX].trim() !== '') {
                article.tagsEF.push(values[E_INDEX].trim());
            }
            
            data.push(article);
        }
    }
    return data;
}

/**
 * Creates a news article card HTML element.
 * @param {Object} article - An object containing article data.
 * @returns {HTMLElement} The created article card element.
 */
function createNewsCard(article) {
    const articleDiv = document.createElement('div');
    articleDiv.className = 'bg-white rounded-lg shadow-lg overflow-hidden transform transition-all duration-300 hover:scale-105 hover:shadow-xl news-article-card';
    
    // Store tags on dataset for filtering
    articleDiv.dataset.tagD = article.tagD;
    articleDiv.dataset.tagsEF = JSON.stringify(article.tagsEF); // This now only contains tags from E

    articleDiv.innerHTML = `
        <img src="${article.imageLink || 'https://placehold.co/400x250/cccccc/333333?text=No+Image'}" 
            alt="${article.title}" 
            class="w-full h-48 object-cover"
            onerror="this.onerror=null;this.src='https://placehold.co/400x250/cccccc/333333?text=Image+Not+Found';">
        <div class="p-6">
            <h2 class="text-xl font-semibold text-gray-900 mb-3">${article.title}</h2>
            <a href="${article.articleLink}" 
                rel="noopener noreferrer" 
                class="inline-block text-blue-600 hover:text-blue-800 font-medium transition-colors duration-200">
                Read more &rarr;
            </a>
            <div class="mt-3 flex flex-wrap gap-1">
                ${article.tagD ? `<span class="bg-gray-100 text-gray-700 text-xs font-semibold px-2.5 py-0.5 rounded-full">${article.tagD}</span>` : ''}
                ${article.tagsEF.length > 0 ? 
                    article.tagsEF.map(tag => `<span class="bg-gray-100 text-gray-700 text-xs font-semibold px-2.5 py-0.5 rounded-full">${tag}</span>`).join('')
                    : ''
                }
            </div>
        </div>
    `;
    return articleDiv;
}

/**
 * Toggles a tag's selection status and triggers filtering for a specific filter group.
 * @param {string} tag - The tag to toggle.
 * @param {'D' | 'EF'} group - The filter group ('D' for Column D, 'EF' for E).
 */
function toggleTag(tag, group) {
    console.log(`toggleTag called for: ${tag} in group: ${group}`);
    let targetSet = group === 'D' ? selectedTagsD : selectedTagsEF;

    if (tag === 'all') {
        targetSet.clear();
        console.log(`Cleared all selected tags for group ${group}.`);
    } else {
        if (targetSet.has(tag)) {
            targetSet.delete(tag);
            console.log(`Removed tag: ${tag} from group ${group}. New selectedTags for ${group}:`, Array.from(targetSet));
        } else {
            targetSet.add(tag);
            console.log(`Added tag: ${tag} to group ${group}. New selectedTags for ${group}:`, Array.from(targetSet));
        }
    }
    filterArticles();
    updateFilterButtonStates();
}

/**
 * Updates the visual active/inactive state of filter buttons.
 */
function updateFilterButtonStates() {
    console.log('updateFilterButtonStates called.');
    console.log('selectedTagsD:', Array.from(selectedTagsD));
    console.log('selectedTagsEF:', Array.from(selectedTagsEF));

    // Update buttons for Column D filters
    document.querySelectorAll('#filter-container-D .filter-button').forEach(button => {
        const tag = button.dataset.tag;
        button.classList.remove('active', 'bg-gray-200', 'text-gray-800', 'hover:bg-gray-300', 'focus:ring-gray-400', 'bg-teal-600', 'text-white', 'hover:bg-teal-700', 'focus:ring-teal-500', 'hover:shadow-md', 'hover:scale-105');

        if (tag === 'all') {
            if (selectedTagsD.size === 0) {
                button.classList.add('active', 'bg-teal-600', 'text-white', 'hover:bg-teal-700', 'focus:ring-teal-500', 'hover:shadow-md', 'hover:scale-105');
            } else {
                button.classList.add('bg-gray-200', 'text-gray-800', 'hover:bg-gray-300', 'focus:ring-gray-400', 'hover:shadow-md');
            }
        } else {
            if (selectedTagsD.has(tag)) {
                button.classList.add('active', 'bg-teal-600', 'text-white', 'hover:bg-teal-700', 'focus:ring-teal-500', 'hover:shadow-md', 'hover:scale-105');
            } else {
                button.classList.add('bg-gray-200', 'text-gray-800', 'hover:bg-gray-300', 'focus:ring-gray-400', 'hover:shadow-md');
            }
        }
    });

    // Update buttons for Column E filters
    document.querySelectorAll('#filter-container-EF .filter-button').forEach(button => {
        const tag = button.dataset.tag;
        button.classList.remove('active', 'bg-gray-200', 'text-gray-800', 'hover:bg-gray-300', 'focus:ring-gray-400', 'bg-teal-600', 'text-white', 'hover:bg-teal-700', 'focus:ring-teal-500', 'hover:shadow-md', 'hover:scale-105');

        if (tag === 'all') {
            if (selectedTagsEF.size === 0) {
                button.classList.add('active', 'bg-teal-600', 'text-white', 'hover:bg-teal-700', 'focus:ring-teal-500', 'hover:shadow-md', 'hover:scale-105');
            } else {
                button.classList.add('bg-gray-200', 'text-gray-800', 'hover:bg-gray-300', 'focus:ring-gray-400', 'hover:shadow-md');
            }
        } else {
            if (selectedTagsEF.has(tag)) {
                button.classList.add('active', 'bg-teal-600', 'text-white', 'hover:bg-teal-700', 'focus:ring-teal-500', 'hover:shadow-md', 'hover:scale-105');
            } else {
                button.classList.add('bg-gray-200', 'text-gray-800', 'hover:bg-gray-300', 'focus:ring-gray-400', 'hover:shadow-md');
            }
        }
    });
}

/**
 * Filters the displayed news articles based on the `selectedTagsD` and `selectedTagsEF`.
 */
function filterArticles() {
    console.log('filterArticles called. Selected tags D:', Array.from(selectedTagsD), 'Selected tags EF:', Array.from(selectedTagsEF));
    const articleCards = newsContainer.querySelectorAll('.news-article-card');
    let articlesFound = false;

    articleCards.forEach(card => {
        let cardTagD = String(card.dataset.tagD || '').trim();
        let cardTagsEF = [];
        try {
            cardTagsEF = JSON.parse(card.dataset.tagsEF || '[]').map(t => String(t).trim()); 
        } catch (e) {
            console.error('Error parsing data-tagsEF for card:', card, 'Error:', e);
            cardTagsEF = [];
        }
        
        let matchesD = false;
        if (selectedTagsD.size === 0) {
            matchesD = true; // No filter from D applied
        } else {
            matchesD = selectedTagsD.has(cardTagD);
        }

        let matchesEF = false;
        if (selectedTagsEF.size === 0) {
            matchesEF = true; // No filter from E applied
        } else {
            // Check if ANY of the card's EF tags match ANY of the selectedTagsEF
            matchesEF = Array.from(selectedTagsEF).some(selectedTag => cardTagsEF.includes(selectedTag.trim()));
        }

        // An article is shown only if it matches both D filter (or D filter is off) AND E filter (or E filter is off)
        if (matchesD && matchesEF) {
            card.classList.remove('hidden');
            articlesFound = true;
        } else {
            card.classList.add('hidden');
        }
        console.log(`Card: "${card.querySelector('h2').textContent}" | D-Tag: "${cardTagD}" | EF-Tags: [${cardTagsEF.join(', ')}] | Match D: ${matchesD} | Match EF: ${matchesEF} | Visible: ${matchesD && matchesEF}`);
    });

    if (!articlesFound) {
        noResultsMessage.classList.remove('hidden');
        console.log('No articles found for current filter combination.');
    } else {
        noResultsMessage.classList.add('hidden');
        console.log('Articles found for current filter combination.');
    }
}

/**
 * Renders filter buttons for a specific group (D or EF).
 * @param {string[]} uniqueTags - Array of unique tags for this group.
 * @param {HTMLElement} container - The DOM element to render buttons into.
 * @param {'D' | 'EF'} group - The filter group identifier.
 * @param {HTMLElement} loadingIndicator - The loading indicator for this filter group.
 */
function renderFilterButtons(uniqueTags, container, group, loadingIndicator) {
    // Preserve the title element while clearing the rest
    const titleElement = container.querySelector('.filter-box-title');
    container.innerHTML = '';
    if (titleElement) {
        container.appendChild(titleElement);
    } else {
        // Fallback title creation
        const newTitle = document.createElement('p');
        newTitle.className = 'filter-box-title';
        newTitle.textContent = group === 'D' ? 'Filter by Category' : 'Filter by Topics';
        container.prepend(newTitle);
    }
    
    loadingIndicator.classList.add('hidden'); // Hide specific loading indicator

    // "All" button
    const allButton = document.createElement('button');
    allButton.className = 'filter-button';
    allButton.textContent = 'All';
    allButton.dataset.tag = 'all';
    allButton.addEventListener('click', () => toggleTag('all', group));
    container.appendChild(allButton);

    // Create buttons for each unique tag
    uniqueTags.forEach(tag => {
        if (tag) { // Only render if tag is not empty after trim
            const button = document.createElement('button');
            button.className = 'filter-button';
            button.textContent = tag;
            button.dataset.tag = tag;
            button.addEventListener('click', () => toggleTag(tag, group));
            container.appendChild(button);
        }
    });
    updateFilterButtonStates(); // Set initial button states
}

/**
 * Fetches news data from the Google Sheet, dynamically populates articles,
 * extracts unique tags, and sets up filter buttons for both groups.
 */
async function fetchAndDisplayNews() {
    console.log('fetchAndDisplayNews started.');
    loadingIndicator.classList.remove('hidden');
    errorMessage.classList.add('hidden');
    noResultsMessage.classList.add('hidden');
    filterLoadingD.classList.remove('hidden');
    filterLoadingEF.classList.remove('hidden');
    newsContainer.innerHTML = '';

    try {
        const response = await fetch(GOOGLE_SHEET_CSV_URL);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
        }

        const csvText = await response.text();
        articlesData = parseCSV(csvText);
        console.log('Raw articlesData after parseCSV:', articlesData);

        if (articlesData.length > 0) {
            const firstRow = articlesData[0];
            // Heuristic for header row removal
            if (firstRow.imageLink.toLowerCase().includes('image') &&
                firstRow.title.toLowerCase().includes('title') &&
                firstRow.articleLink.toLowerCase().includes('link') &&
                firstRow.tagD.toLowerCase().includes('tag') && 
                firstRow.tagsEF.some(tag => tag.toLowerCase().includes('tag')) 
                ) {
                articlesData.shift();
                console.log('Header row removed. ArticlesData now:', articlesData);
            }
        }

        if (articlesData.length === 0) {
            newsContainer.innerHTML = '<p class="col-span-full text-center text-gray-600 text-lg p-8">No news articles found or the sheet is empty.</p>';
            filterContainerD.innerHTML = '<p class="filter-box-title">Filter by Category</p><p class="text-gray-500">No categories available.</p>';
            filterContainerEF.innerHTML = '<p class="filter-box-title">Filter by Topics</p><p class="text-gray-500">No topics available.</p>';
            console.log('No articles found or sheet empty after header check.');
            return;
        }

        // Render all articles initially
        articlesData.forEach(article => {
            const card = createNewsCard(article);
            newsContainer.appendChild(card);
        });
        console.log('All article cards rendered.');

        // Extract unique tags for Column D
        const allTagsD = new Set();
        articlesData.forEach(article => {
            if (article.tagD) allTagsD.add(article.tagD.trim());
        });
        const uniqueTagsD = Array.from(allTagsD).sort();
        console.log('Unique Column D tags extracted and sorted:', uniqueTagsD);

        // Extract unique tags for Column E (formerly E & F)
        const allTagsEF = new Set();
        articlesData.forEach(article => {
            article.tagsEF.forEach(tag => allTagsEF.add(tag.trim()));
        });
        const uniqueTagsEF = Array.from(allTagsEF).sort();
        console.log('Unique Column E tags extracted and sorted:', uniqueTagsEF);

        // Render filter buttons for both groups
        renderFilterButtons(uniqueTagsD, filterContainerD, 'D', filterLoadingD);
        renderFilterButtons(uniqueTagsEF, filterContainerEF, 'EF', filterLoadingEF);
        
        filterArticles(); // Apply initial filter (show all)
        console.log('Initial filtering and button state update complete.');

    } catch (error) {
        console.error('Error fetching or parsing news data:', error);
        errorMessage.classList.remove('hidden');
        errorMessage.textContent = `Failed to load news articles: ${error.message}. Please ensure the Google Sheet is published to the web as CSV and publicly accessible.`;
        filterContainerD.innerHTML = '<p class="filter-box-title">Filter by Category</p><p class="text-red-500">Could not load categories.</p>';
        filterContainerEF.innerHTML = '<p class="filter-box-title">Filter by Topics</p><p class="text-red-500">Could not load topics.</p>';
    } finally {
        loadingIndicator.classList.add('hidden');
        filterLoadingD.classList.add('hidden');
        filterLoadingEF.classList.add('hidden');
        console.log('fetchAndDisplayNews finished.');
    }
}

// Fetch news when the page loads
window.onload = fetchAndDisplayNews;
