// Function to display info when program icons are clicked
function showInfo(service) {
    const infoBox = document.getElementById('infoBox');

    switch(service) {
        case 'backend':
            infoBox.innerHTML = "<b>Backend Development</b><br>Working with .NET Framework to develop server-side logic. Learning to build APIs and services while following best practices for maintainable code.";
            break;
        case 'frontend':
            infoBox.innerHTML = "<b>Frontend Development</b><br>Creating user interfaces with HTML/CSS. Developing web pages that are responsive and user-friendly while expanding my skills in modern web technologies.";
            break;
        case 'database':
            infoBox.innerHTML = "<b>Database Design</b><br>Working with SQL databases and learning efficient schema design. Implementing database solutions while building experience with data management concepts.";
            break;
        case 'architecture':
            infoBox.innerHTML = "<b>System Architecture</b><br>Learning about system design principles. Understanding how different components work together to create cohesive applications as I grow my development experience.";
            break;
        case 'optimization':
            infoBox.innerHTML = "<b>Code Optimization</b><br>Improving code efficiency and readability. Practicing techniques to write cleaner, faster code while developing my skills in performance analysis.";
            break;
        default:
            infoBox.innerHTML = "Click an icon to learn more about what I'm focusing on as a graduate developer...";
    }
}