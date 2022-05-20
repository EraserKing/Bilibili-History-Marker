// ==UserScript==
// @name         Bilibili History Marker
// @namespace    https://github.com/EraserKing/Bilibili-History-Marker
// @version      0.3
// @description  Add watched and watch later icon to video links
// @author       EraserKing
// @match        https://space.bilibili.com/*
// @match        https://www.bilibili.com/video/*
// @match        https://www.bilibili.com/watchlater/*
// @match        https://t.bilibili.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=bilibili.com
// @connect      api.bilibili.com
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_log
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @updateUrl    https://github.com/EraserKing/Bilibili-History-Marker/raw/main/bilibili-history-marker.user.js
// @downloadUrl  https://github.com/EraserKing/Bilibili-History-Marker/raw/main/bilibili-history-marker.user.js
// ==/UserScript==

(function () {
  "use strict";
  refreshLocalHistory();
  refreshLocalWatchLater();
  addStyles();

  switch (window.location.hostname) {
    case "space.bilibili.com":
      performInitialProgress(
        addProgressToSpacePage,
        registerViewUpdateToSpacePage
      );
      break;

    case "t.bilibili.com":
      performInitialProgress(
        addProgressToDynamicPage,
        registerViewUpdateToDynamicPage
      );
      break;

    case "www.bilibili.com":
      if (window.location.pathname.indexOf("/video/") > -1) {
        performInitialProgress(addProgressToVideoPage, null);
      } else if (window.location.pathname.indexOf("/watchlater/") > -1) {
        performInitialProgress(addProgressToWatchLaterPage, null);
      }
      break;
  }

  function addStyles() {
    GM_addStyle(".bhm-video-watched-finished::before {content: '✅'}");
    GM_addStyle(".bhm-video-watched-partially::before {content: '☑️'}");

    GM_addStyle(".bhm-video-watch-later-finished::before {content: '⌛'}");
    GM_addStyle(".bhm-video-watch-later-partially::before {content: '⏳'}");
  }

  function performInitialProgress(
    addProgressToSpecificPage,
    registerProgressToSpecificPage
  ) {
    // Only start processing when local history is not empty
    const addProgressTimer = setInterval(() => {
      const currentHistoryMapString = GM_getValue("local_history_map", "");
      const currentWatchLaterMapString = GM_getValue(
        "local_watch_later_map",
        ""
      );

      if (currentHistoryMapString !== "" && currentWatchLaterMapString !== "") {
        clearInterval(addProgressTimer);
        const currentHistoryMap = JSON.parse(currentHistoryMapString);
        const currentWatchLaterMap = JSON.parse(currentWatchLaterMapString);

        addProgressToSpecificPage(currentHistoryMap, currentWatchLaterMap);
        if (registerProgressToSpecificPage !== null) {
          registerProgressToSpecificPage(
            addProgressToSpecificPage,
            currentHistoryMap,
            currentWatchLaterMap
          );
        }
      } else {
        GM_log(
          "Bilibili History Marker: No local history or watch later found yet, wait 2s"
        );
      }
    }, 2000);
  }

  function registerViewUpdateToSpacePage(
    addProgressToPage,
    currentHistoryMap,
    currentWatchLaterMap
  ) {
    // Add listener for update
    Array.from(
      document.querySelectorAll(
        "div.item.style > span, ul.be-pager > li.be-pager-item, ul.be-pager > li.be-pager-prev, ul.be-pager > li.be-pager-next, div.section.video a.more, ul.be-tab-inner > li"
      )
    )
      .filter((item) => !item.isProgressEventListenerAdded)
      .forEach((item) => {
        item.isProgressEventListenerAdded = true;
        item.addEventListener("click", () => {
          GM_log(
            "Bilibili History Marker: view / page / see more / sort by updated"
          );
          performInitialProgress(
            addProgressToPage,
            registerViewUpdateToSpacePage
          );
        });
      });

    GM_log(
      "Bilibili History Marker: Event registered when view, page, see more, or sort by updated"
    );
  }

  function addProgressToSpacePage(currentHistoryMap, currentWatchLaterMap) {
    // Find main content section
    document
      .querySelectorAll(".video div.content, div.channel-video")
      .forEach((parent) => {
        const addProgressTimer = setInterval(() => {
          const titleLinks = parent.querySelectorAll("a.title");
          // If no links found, the page might be loading. Wait 2s.
          if (titleLinks.length > 0) {
            clearInterval(addProgressTimer);
            processLinks(
              titleLinks,
              currentHistoryMap,
              currentWatchLaterMap,
              null
            );
          } else {
            GM_log(
              "Bilibili History Marker: No item obtained in page, wait 2s"
            );
          }
        }, 2000);
      });

    GM_log("Bilibili History Marker: History added to links");
  }

  function addProgressToVideoPage(currentHistoryMap, currentWatchLaterMap) {
    // Find main content section
    const addProgressTimer = setInterval(() => {
      const titleLinks = document.querySelectorAll(
        "div#reco_list div.info a[class]"
      );
      // If no links found, the page might be loading. Wait 2s.
      if (titleLinks.length > 0) {
        clearInterval(addProgressTimer);
        processLinks(
          titleLinks,
          currentHistoryMap,
          currentWatchLaterMap,
          Array.from(titleLinks).map((link) => link.querySelector("p"))
        );
      } else {
        GM_log("Bilibili History Marker: No item obtained in page, wait 2s");
      }
    }, 2000);

    GM_log("Bilibili History Marker: History added to links");
  }

  function addProgressToDynamicPage(currentHistoryMap, currentWatchLaterMap) {
    // Find main content section
    const addProgressTimer = setInterval(() => {
      const titleLinks = document.querySelectorAll(
        "div.bili-dyn-item a.bili-dyn-card-video"
      );
      if (titleLinks.length > 0) {
        clearInterval(addProgressTimer);
        processLinks(
          titleLinks,
          currentHistoryMap,
          currentWatchLaterMap,
          Array.from(titleLinks).map((link) =>
            link.querySelector("div.bili-dyn-card-video__title")
          )
        );
      }
    }, 2000);

    GM_log("Bilibili History Marker: History added to links");
  }

  function registerViewUpdateToDynamicPage(
    addProgressToPage,
    currentHistoryMap,
    currentWatchLaterMap
  ) {
    // Add listener for update
    const listNode = document.querySelector("div.bili-dyn-list__items");
    const config = { childList: true };
    const observer = new MutationObserver((mutations, observer) => {
      mutations
        .filter((m) => m.type === "childList")
        .forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            addClassForLink(
              node.querySelector("a.bili-dyn-card-video"),
              currentHistoryMap,
              currentWatchLaterMap,
              node.querySelector("div.bili-dyn-card-video__title")
            );
          });
        });
    });
    observer.observe(listNode, config);

    GM_log(
      "Bilibili History Marker: Event registered when new dynamics are loaded"
    );
  }

  function addProgressToWatchLaterPage(
    currentHistoryMap,
    currentWatchLaterMap
  ) {
    // Find main content section
    const addProgressTimer = setInterval(() => {
      const titleLinks = document.querySelectorAll(
        "div.list-box div.av-item div.av-about"
      );
      if (titleLinks.length > 0) {
        clearInterval(addProgressTimer);
        processLinks(
          titleLinks,
          currentHistoryMap,
          currentWatchLaterMap,
          null,
          { watchLater: "skip" }
        );
      }
    }, 2000);

    GM_log("Bilibili History Marker: History added to links");
  }

  function processLinks(
    links,
    currentHistoryMap,
    currentWatchLaterMap,
    classAttachTargetElements,
    classOptions
  ) {
    Array.from(links)
      .filter(
        (titleLink, i) =>
          (classAttachTargetElements === null
            ? titleLink
            : classAttachTargetElements[i]
          ).className.indexOf("bhm-video-") === -1
      )
      .forEach((titleLink, i) =>
        addClassForLink(
          titleLink,
          currentHistoryMap,
          currentWatchLaterMap,
          classAttachTargetElements === null
            ? null
            : classAttachTargetElements[i],
          classOptions
        )
      );
  }

  function addClassForLink(
    link,
    currentHistoryMap,
    currentWatchLaterMap,
    classAttachTargetElement,
    classOptions
  ) {
    const [isVideo, bvNumber] = getVideoBv(link.href);
    if (isVideo) {
      (classAttachTargetElement ?? link).className +=
        " " +
        getNewClassForLink(
          bvNumber,
          currentHistoryMap,
          currentWatchLaterMap,
          classOptions
        );
    }
  }

  function getVideoBv(href) {
    const match = href.match("/video/([^/]+)");
    if (match !== null) {
      return [true, match[1]];
    } else {
      return [false, ""];
    }
  }

  function getNewClassForLink(
    bvNumber,
    currentHistoryMap,
    currentWatchLaterMap,
    classOptions
  ) {
    let finalResult = "";

    if (classOptions?.history !== "skip") {
      if (currentHistoryMap.hasOwnProperty(bvNumber)) {
        finalResult +=
          currentHistoryMap[bvNumber] === -1
            ? "bhm-video-watched-finished"
            : "bhm-video-watched-partially";
      } else {
        finalResult += "bhm-video-watched-none";
      }

      finalResult += " ";
    }

    if (classOptions?.watchLater !== "skip") {
      if (currentWatchLaterMap.hasOwnProperty(bvNumber)) {
        finalResult +=
          currentWatchLaterMap[bvNumber] === -1
            ? "bhm-video-watch-later-finished"
            : "bhm-video-watch-later-partially";
      } else {
        finalResult += "bhm-video-watch-later-none";
      }
    }

    return finalResult;
  }

  function addHistoryToMap(pageNumber, historyMap) {
    if (pageNumber < 5) {
      GM_xmlhttpRequest({
        method: "GET",
        url: `https://api.bilibili.com/x/v2/history?ps=300&pn=${pageNumber}`,
        responseType: "json",
        onload: (res) => {
          GM_log(
            `Bilibili History Marker: Reading history of page ${pageNumber}`
          );
          res.response.data.forEach((d) => {
            historyMap[d.bvid] = d.progress;
          });
          addHistoryToMap(pageNumber + 1, historyMap);
        },
        onerror: (error) => {
          GM_log("Bilibili History Marker: Unable to obtain history");
          GM_log(error);
        },
      });
    } else {
      const finalHistoryMapString = JSON.stringify(historyMap);
      GM_setValue("local_history_last_fetch", Date.now());
      GM_setValue("local_history_map", finalHistoryMapString);
      GM_log("Bilibili History Marker: Local history storage updated");
    }
  }

  function addWatchLaterToMap(watchLaterMap) {
    GM_xmlhttpRequest({
      method: "GET",
      url: `https://api.bilibili.com/x/v2/history/toview`,
      responseType: "json",
      onload: (res) => {
        GM_log(`Bilibili History Marker: Reading watch later`);
        res.response.data.list.forEach((d) => {
          watchLaterMap[d.bvid] = d.progress;
        });

        const finalWatchLaterMapString = JSON.stringify(watchLaterMap);
        GM_setValue("local_watch_later_last_fetch", Date.now());
        GM_setValue("local_watch_later_map", finalWatchLaterMapString);
        GM_log("Bilibili History Marker: Local watch later storage updated");
      },
      onerror: (error) => {
        GM_log("Bilibili History Marker: Unable to obtain watch later");
        GM_log(error);
      },
    });
  }

  function refreshLocalHistory() {
    const lastFetchDateTime = GM_getValue("local_history_last_fetch") ?? 0;
    const alwaysRefresh = false;

    let historyMap = {};

    // Fetch per 15 min
    if (alwaysRefresh || Date.now() - lastFetchDateTime > 15 * 60 * 1000) {
      GM_setValue("local_history_map", "");
      addHistoryToMap(0, historyMap);
    } else {
      GM_log(
        "Bilibili History Marker: Local history minimum refresh interval not reached"
      );
    }
  }

  function refreshLocalWatchLater() {
    const lastFetchDateTime = GM_getValue("local_watch_later_last_fetch") ?? 0;
    const alwaysRefresh = false;

    let watchLaterMap = {};

    // Fetch per 15 min
    if (alwaysRefresh || Date.now() - lastFetchDateTime > 15 * 60 * 1000) {
      GM_setValue("local_watch_later_map", "");
      addWatchLaterToMap(watchLaterMap);
    } else {
      GM_log(
        "Bilibili History Marker: Local watch later minimum refresh interval not reached"
      );
    }
  }
})();
