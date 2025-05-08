function formatCustomDateTime(isoString) {
    if (!isoString) {
        return "N/A";
    }
    const dateObj = new Date(isoString); // Parses the ISO string
    const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN",
        "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    const day = dateObj.getDate();
    const month = monthNames[dateObj.getMonth()]; // getMonth() is 0-indexed

    const hours = String(dateObj.getHours()).padStart(2, '0'); // 24-hour format
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    return `${day} ${month}, ${hours}:${minutes}`; // e.g., "7 MAY, 08:35" - all caps for month
}