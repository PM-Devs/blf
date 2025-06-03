 const form = document.getElementById('dcgt-form');
    const tbody = document.querySelector('#records tbody');
    const successMessage = document.getElementById('success-message');
    let chart = null;

    // Set today's date as default
    document.getElementById('date').valueAsDate = new Date();

    form.addEventListener('submit', async e => {
      e.preventDefault();
      
      const submitBtn = form.querySelector('.submit-btn');
      const originalText = submitBtn.textContent;
      submitBtn.textContent = 'Submitting...';
      submitBtn.disabled = true;

      try {
        const data = {
          date: form.date.value,
          eventName: form.eventName.value,
          organizer: form.organizer.value,
          gifter: form.gifter.value,
          coinsOut: +form.coinsOut.value,
          coinsIn: +form.coinsIn.value,
          net: +form.coinsIn.value - +form.coinsOut.value,
          supportTeam: form.supportTeam.value,
          conversionNotes: form.conversionNotes.value
        };

        const response = await fetch('https://blf-tuyq.onrender.com/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });

        if (response.ok) {
          form.reset();
          document.getElementById('date').valueAsDate = new Date(); // Reset date to today
          showSuccessMessage();
          await loadData();
        } else {
          throw new Error('Failed to submit record');
        }
      } catch (error) {
        console.error('Error submitting record:', error);
        alert('Failed to submit record. Please try again.');
      } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
      }
    });

    function createChart(data) {
      const ctx = document.getElementById('performanceChart').getContext('2d');
      
      // Destroy existing chart if it exists
      if (chart) {
        chart.destroy();
      }

      // Prepare data for the last 10 records or all if less than 10
      const recentData = data.slice(0, 10).reverse();
      const labels = recentData.map(r => `${r.eventName.substring(0, 15)}...`);
      const coinsOut = recentData.map(r => r.coinsOut);
      const coinsIn = recentData.map(r => r.coinsIn);
      const netValues = recentData.map(r => r.coinsIn - r.coinsOut);

      chart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [
            {
              label: 'Coins Out (Gifted)',
              data: coinsOut,
              backgroundColor: 'rgba(248, 113, 113, 0.8)',
              borderColor: 'rgba(248, 113, 113, 1)',
              borderWidth: 1
            },
            {
              label: 'Coins In (Attracted)',
              data: coinsIn,
              backgroundColor: 'rgba(74, 222, 128, 0.8)',
              borderColor: 'rgba(74, 222, 128, 1)',
              borderWidth: 1
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              labels: {
                color: '#ffffff',
                font: {
                  size: 12
                }
              }
            },
            tooltip: {
              callbacks: {
                afterLabel: function(context) {
                  const index = context.dataIndex;
                  const net = netValues[index];
                  return `Net: ${net >= 0 ? '+' : ''}${net.toLocaleString()} coins`;
                }
              }
            }
          },
          scales: {
            x: {
              ticks: {
                color: '#cccccc',
                font: {
                  size: 10
                }
              },
              grid: {
                color: 'rgba(255, 255, 255, 0.1)'
              }
            },
            y: {
              ticks: {
                color: '#cccccc',
                callback: function(value) {
                  return value.toLocaleString();
                }
              },
              grid: {
                color: 'rgba(255, 255, 255, 0.1)'
              }
            }
          }
        }
      });
    }

    function showSuccessMessage() {
      successMessage.style.display = 'block';
      setTimeout(() => {
        successMessage.style.display = 'none';
      }, 3000);
    }

    function formatNet(coinsIn, coinsOut) {
      const net = coinsIn - coinsOut;
      if (net > 0) return `<span class="net-positive">+${net.toLocaleString()}</span>`;
      if (net < 0) return `<span class="net-negative">${net.toLocaleString()}</span>`;
      return `<span class="net-zero">${net.toLocaleString()}</span>`;
    }

    function formatDate(dateStr) {
      try {
        return new Date(dateStr).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
      } catch {
        return dateStr;
      }
    }

    function truncateText(text, maxLength = 30) {
      if (!text) return '';
      return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }

    async function loadData() {
      try {
        const res = await fetch('https://blf-tuyq.onrender.com/records');
        const rows = await res.json();
        
        tbody.innerHTML = '';
        
        if (rows.length === 0) {
          tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 2rem; color: #666;">No records found</td></tr>';
          return;
        }

        rows.forEach(r => {
          const row = document.createElement('tr');
          row.innerHTML = `
            <td>${formatDate(r.date)}</td>
            <td title="${r.eventName}">${truncateText(r.eventName, 25)}</td>
            <td>${r.organizer}</td>
            <td>${r.gifter}</td>
            <td>${r.coinsOut.toLocaleString()}</td>
            <td>${r.coinsIn.toLocaleString()}</td>
            <td>${formatNet(r.coinsIn, r.coinsOut)}</td>
            <td>${r.supportTeam || '-'}</td>
            <td title="${r.conversionNotes}">${truncateText(r.conversionNotes, 40)}</td>
          `;
          tbody.appendChild(row);
        });

        // Create/update chart with the data
        createChart(rows);
      } catch (error) {
        console.error('Error loading data:', error);
        tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 2rem; color: #f87171;">Failed to load records</td></tr>';
      }
    }

    // Load data on page load
    loadData();