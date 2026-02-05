// Inicializar Lucide Icons
lucide.createIcons();

document.addEventListener("DOMContentLoaded", function () {
    // Mobile menu toggle - Versión mejorada
    const mobileMenuButton = document.getElementById("mobile-menu-button");
    const mobileMenu = document.getElementById("mobile-menu");
    
    // Función para alternar el menú
    const toggleMenu = () => {
        mobileMenu.classList.toggle("hidden");
    };
    
    // Evento del botón del menú
    mobileMenuButton.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleMenu();
    });
    
    // Cerrar menú al hacer clic fuera
    document.addEventListener("click", (e) => {
        const isClickInsideMenu = mobileMenu.contains(e.target);
        const isClickOnButton = mobileMenuButton.contains(e.target);
        
        if (!mobileMenu.classList.contains("hidden") && !isClickInsideMenu && !isClickOnButton) {
            mobileMenu.classList.add("hidden");
        }
    });
    
    // Evitar que el menú se cierre al hacer clic dentro de él
    mobileMenu.addEventListener("click", (e) => {
        e.stopPropagation();
    });
    
    // Cerrar menú con tecla Escape
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && !mobileMenu.classList.contains("hidden")) {
            mobileMenu.classList.add("hidden");
        }
    });

    // Betting section tabs logic (se mantiene igual para funcionalidad interna)
    const bettingTabs = document.getElementById("betting-tabs");
    if (bettingTabs) {
        const bettingTabButtons = bettingTabs.querySelectorAll(".tab-button");
        const bettingTabContents = document
            .getElementById("betting-tab-content")
            .querySelectorAll(".tab-content");

        bettingTabButtons.forEach(button => {
            button.addEventListener("click", () => {
                // Deactivate all
                bettingTabButtons.forEach(btn =>
                    btn.classList.remove("active")
                );
                bettingTabContents.forEach(content =>
                    content.classList.remove("active")
                );

                // Activate clicked
                button.classList.add("active");
                const targetContentId = button.getAttribute("data-target");
                document
                    .getElementById(targetContentId)
                    .classList.add("active");
            });
        });
    }

    // Accordion logic for guides (se mantiene igual)
    const accordionButtons = document.querySelectorAll(".card button");
    accordionButtons.forEach(button => {
        if (button.querySelector('i[data-lucide="chevron-down"]')) {
            button.addEventListener("click", () => {
                const content = button.nextElementSibling;
                const icon = button.querySelector("i");

                if (content.style.display === "block") {
                    content.style.display = "none";
                    icon.style.transform = "rotate(0deg)";
                } else {
                    content.style.display = "block";
                    icon.style.transform = "rotate(180deg)";
                }
            });
        }
    });

    // Activar el enlace del menú correspondiente a la página actual
    const navLinks = document.querySelectorAll('.nav-link');
    const currentPath = window.location.pathname;
    
    navLinks.forEach(link => {
        const linkPath = link.getAttribute('href');
        
        // Comparar la ruta actual con la del enlace
        if (currentPath === linkPath || 
            (currentPath.startsWith(linkPath) && linkPath !== '/')) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
});

/*if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const swUrl = `${window.location.origin}/sw.js`;
    navigator.serviceWorker.register(swUrl)
      .then(registration => {
        console.log('Service Worker registrado con éxito:', registration.scope);
      })
      .catch(error => {
        console.error('Error al registrar el Service Worker:', error);
      });
  });
}*/

let deferredPrompt;

// Seleccionamos el botón que creamos
const installButton = document.getElementById('install-pwa-button');

window.addEventListener('beforeinstallprompt', (e) => {
  // Prevenimos que Chrome muestre su propio aviso de instalación (el mini-infobar)
  e.preventDefault();
  
  // Guardamos el evento para poder usarlo más tarde
  deferredPrompt = e;
  
  // Mostramos nuestro botón de instalación personalizado
  if (installButton) {
    installButton.classList.remove('hidden');
    //console.log('`beforeinstallprompt` fue disparado. El botón de instalación está visible.');
  }
});

if (installButton) {
  installButton.addEventListener('click', async () => {
    // Si no tenemos un evento guardado, no hacemos nada
    if (!deferredPrompt) {
      return;
    }
    
    // Mostramos el aviso de instalación del navegador
    deferredPrompt.prompt();
    
    // Esperamos a que el usuario responda al aviso
    const { outcome } = await deferredPrompt.userChoice;
    //console.log(`El usuario respondió al aviso: ${outcome}`);
    
    // Ya no necesitamos el evento, lo descartamos
    deferredPrompt = null;
    
    // Ocultamos nuestro botón, ya que ya no se puede usar
    installButton.classList.add('hidden');
  });
}

// Opcional: Escucha cuando la app ya ha sido instalada
window.addEventListener('appinstalled', () => {
  //console.log('¡PWA instalada con éxito!');
  // Oculta el botón de instalación si aún estuviera visible
  if (installButton) {
    installButton.classList.add('hidden');
  }
  deferredPrompt = null;
});

// Script para manejar el dropdown en móvil
  document.getElementById('pronosticos-dropdown-button').addEventListener('click', function() {
    const dropdown = document.getElementById('pronosticos-dropdown');
    const chevron = document.getElementById('pronosticos-chevron');
    
    dropdown.classList.toggle('hidden');
    chevron.classList.toggle('rotate-180');
  });