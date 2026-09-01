function openModal() {
document.getElementById('editModal').classList.add('active');
document.body.style.overflow = 'hidden';
setTimeout(() => {
    document.getElementById('editName').focus();
}, 100);
}

function closeModal() {
document.getElementById('editModal').classList.remove('active');
document.body.style.overflow = '';
}
document.addEventListener('keydown', (e) => {
    if (
        e.key === 'Escape' &&
        document
            .getElementById('editModal')
            .classList
            .contains('active')
    ) {closeModal(); }
});

function saveProfile() {
const name =
    document.getElementById('editName').value;

const email =
    document.getElementById('editEmail').value;

const phone =
    document.getElementById('editPhone').value;

document.querySelector('.username').textContent = name;

document.querySelector(
    '.meta-row span:nth-child(1)'
).innerHTML =
    '<i class="fa-regular fa-envelope"></i> ' + email;

document.querySelector(
    '.meta-row span:nth-child(2)'
).innerHTML =
    '<i class="fa-solid fa-phone"></i> ' + phone;

const btn =
    document.querySelector('.modal .btn-primary');
const oldText = btn.innerHTML;

btn.innerHTML =
    '<i class="fa-solid fa-check-circle"></i> Saved';
btn.style.background = '#2e7d32';

setTimeout(() => {
    btn.innerHTML = oldText;
    btn.style.background = '';
}, 1500);
}
