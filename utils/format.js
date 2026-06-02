module.exports = {
  formatMoney: (number, fractional = false) => {
    if (fractional) {
      number = parseFloat(number).toFixed(2);
    }
    let s = String(number);
    let replaced = s.replace(/(-?\d+)(\d\d\d)/, '$1,$2');
    while (replaced !== s) {
      s = replaced;
      replaced = s.replace(/(-?\d+)(\d\d\d)/, '$1,$2');
    }
    return s;
  },
  formatDate: (date) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true });
  },
  formatTime: (date) => {
    if (!date) return '--:--';
    const d = new Date(date);
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  }
};
