function openEditLinkDialog() {
    var fileInput = jQuery('#nicepage-file-field');
    var submitButton = jQuery("#np-upload-file");
    var uploadFileNp = null;
    var dialog = jQuery('#wp-link');
    var data = window.dataForDialog;

    fileInput.bind({
        change: function () {
            if (this.files[0]) {
                uploadFileNp = this.files[0];
                submit(uploadFileNp);
            } else {
                uploadFileNp = null;
            }
        }
    });

    submitButton.click(function () {

        if (!uploadFileNp) {
            fileInput.click();
            return;
        }
        submit(uploadFileNp);
    });

    function submit(file, options) {
        var onCompleteNp = function (response) {
            setTimeout(function () {
                fileInput.val('');
                uploadFileNp = null;
            }, 200);
            jQuery('body').trigger('upload-complete');
            addFileLinks(dialog.find('#file-links-list'), response.result);
            dialog.find('.anchor-link input[value="file"]').click();
            dialog.find('#file-links-list li').eq(0).click();
            var filteredItems = window.phpVars.mediaFiles.data.filter(function (item) {
                return item.url === response.result.url;
            });
            if (!filteredItems.length) {
                window.phpVars.mediaFiles.data.push(response.result);
            }
        };
        var onErrorNp = function (xhr) {
            alert(JSON.parse(xhr.responseText).message);
            console.error(JSON.stringify(xhr, null, '\t'));
            jQuery('body').trigger('upload-error');
            uploadFileNp = null;
        };

        var uploaderFile = new ChunkedUploaderFile(
            file,
            {
                complete: onCompleteNp,
                error: onErrorNp
            },
            jQuery.extend(true, options || {}, {
                url: dataBridge.settings.ajaxData.uid,
                _wpnonce: dataBridge.settings.ajaxData._ajax_nonce,
                uploadId: Math.random()
            })
        );
        uploaderFile.uploadFile();
    }

    function ChunkedUploaderFile(file, params, formParams) {
        'use strict';

        var upload_file = file;
        if (upload_file instanceof Uint8Array) {
            upload_file = new Blob([upload_file]);
        }
        var CHUNK_SIZE_NP = parseInt((window.phpVars.maxRequestSize || (1024 * 1024)) * 0.9);
        var uploadedChunkNumberNp = 0;
        var allChunks;
        var fileName = (upload_file.name || 'content').replace(/[^A-Za-z0-9\._]/g, '');
        var fileSizeNp = upload_file.size || upload_file.length;
        var totalNp = Math.ceil(fileSizeNp / CHUNK_SIZE_NP);

        var rangeStartNp = 0;
        var rangeEndNp = CHUNK_SIZE_NP;
        validateRangeNp();

        var sliceMethodNp;

        if ('mozSlice' in upload_file) {
            sliceMethodNp = 'mozSlice';
        } else if ('webkitSlice' in upload_file) {
            sliceMethodNp = 'webkitSlice';
        } else {
            sliceMethodNp = 'slice';
        }

        this.uploadFile = uploadFile;
        var requestsNp;

        function uploadFile() {
            var data;

            setTimeout(function () {
                requestsNp = [];

                for (var chunk = 0; chunk < totalNp - 1; chunk++) {
                    data = upload_file[sliceMethodNp](rangeStartNp, rangeEndNp);
                    requestsNp.push(createChunkNp(data, formParams));
                    incrementRangeNp();
                }

                allChunks = requestsNp.length + 1;

                jQuery.when.apply(jQuery, requestsNp).then(
                    function success() {
                        var lastChunkData = upload_file[sliceMethodNp](rangeStartNp, rangeEndNp);
                        createChunkNp(lastChunkData, jQuery.extend(true, {last: true}, formParams));
                    },
                    onUploadFailed
                );
            }, 0);
        }

        function createChunkNp(data, params) {
            var formData = new FormData();
            formData.append('filename', fileName);
            formData.append('chunk', new Blob([data], {type: 'application/octet-stream'}), 'blob');

            if (typeof params === 'object') {
                for (var i in params) {
                    if (params.hasOwnProperty(i)) {
                        formData.append(i, params[i]);
                    }
                }
            }

            return jQuery.ajax({
                url: window.phpVars.uploadFileLink,
                data: formData,
                type: 'POST',
                mimeType: 'application/octet-stream',
                processData: false,
                contentType: false,
                headers: (rangeEndNp <= fileSizeNp) ? {
                    'Content-Range': ('bytes ' + rangeStartNp + '-' + rangeEndNp + '/' + fileSizeNp)
                } : {},
                success: onChunkCompleted,
                error: onUploadFailed
            });
        }

        function validateRangeNp() {
            if (rangeEndNp > fileSizeNp) {
                rangeEndNp = fileSizeNp;
            }
        }

        function incrementRangeNp() {
            rangeStartNp = rangeEndNp;
            rangeEndNp = rangeStartNp + CHUNK_SIZE_NP;
            validateRangeNp();
        }

        function onUploadFailed(xhr) {
            if (xhr.statusText === 'abort') {
                return;
            }

            if (requestsNp) {
                jQuery.each(requestsNp, function () {
                    this.abort();
                });
            }
            params.error(xhr);
        }

        function onChunkCompleted(responseText, status, xhr) {
            var response;
            try {
                response = JSON.parse(responseText);
                if (response.status === 'error') {
                    onUploadFailed(xhr);
                    return false;
                }
            } catch (e) {
                onUploadFailed(xhr);
                return false;
            }

            ++uploadedChunkNumberNp;
            if (uploadedChunkNumberNp === allChunks) {
                params.complete(response);
            } else {
                params.progress(Math.round((100 * uploadedChunkNumberNp) / allChunks));
            }
        }
    }
}

function createListItem(typeInfo, item) {
    if (!item) {
        return item;
    }
    var result = jQuery('<li><input type="hidden" class="item-permalink"><span class="item-title"></span><span class="item-info">' + (typeInfo || 'Section') + '</span></li>');
    result.children('input').attr('value', item.url);
    result.children('span.item-title').text(item.title);
    return result;
}

function createFileListItem(file) {
    if (!file) {
        return file;
    }
    var result = jQuery('<li><input type="hidden" class="item-permalink"><span class="item-title"></span><span class="item-info">File</span></li>');
    result.children('input').attr('value', file.url);
    result.children('span.item-title').text(file.title);
    return result;
}

function addListItem(table, element, prepend = false) {
    if (prepend) {
        table.find('ul').prepend(element);
    } else {
        table.find('ul').append(element);
    }
}

function fixAlternateStyles(table) {
    table.find('li:even').addClass('alternate');
    table.find('li:odd').removeClass('alternate');
}

function addItemLinks(table, data, typeInfo) {
    if (!data || !data.length) {
        return;
    }
    var listItems = jQuery.map(data, createListItem.bind(null, typeInfo));
    jQuery.each(listItems, function (i, item) {
        addListItem(table, item);
    });
    fixAlternateStyles(table);
}

function addFileLinks(table, data) {
    if (!data) {
        return;
    }
    if (data.length) {
        var listItems = jQuery.map(data, createFileListItem);
        jQuery.each(listItems, function (i, item) {
            addListItem(table, item, true);
        });
    } else {
        if (!data.title || !data.url) {
            return;
        }
        var listItem = createFileListItem(data);
        addListItem(table, listItem, true);
    }
    fixAlternateStyles(table);
}

function selectListItemByUrl(list, url) {
    var matchUrl = function (index, element) {
        return jQuery(element).children('.item-permalink').prop('value') === url;
    }
    var listItems = list.find('li'),
        active = listItems.filter(matchUrl);
    if (active.hasClass('selected')) {
        return;
    }
    listItems.removeClass('selected');
    active.addClass('selected');
}

function handleAnchorListItemClick(event) {
    var element = jQuery(this),
        dialog = element.closest('#wp-link'),
        list = element.closest('ul');
    wpLink.updateFields(event, element);
    selectListItemByUrl(list, jQuery('#wp-link-url').prop('value'));
}

function handleLinkCheckboxChange(event) {
    var input = jQuery(this),
        dialog = input.closest('#wp-link'),
        list = dialog.find('#anchor-links-list'),
        dialogList = dialog.find('#dialog-links-list'),
        fileList = dialog.find('#file-links-list'),
        pageList = dialog.find('#most-recent-results'),
        value = input.attr('value'),
        searchField = dialog.find('.link-search-wrapper label'),
        phoneField = dialog.find('.link-phone-number'),
        emailField = dialog.find('.link-email'),
        emailSubjectField = dialog.find('.link-email-subject'),
        urlField = dialog.find('#wp-link-url').parents('div').eq(0),
        urlCheckbox = dialog.find('.link-target');
    if (value === "section") {
        urlCheckbox.removeClass('hidden');
        urlField.removeClass('hidden');
        pageList.addClass('hidden');
        emailField.addClass('hidden');
        emailSubjectField.addClass('hidden');
        phoneField.addClass('hidden');
        fileList.addClass('hidden');
        dialogList.addClass('hidden');
        list.removeClass('hidden');
        searchField.addClass('hidden');
        selectListItemByUrl(list, jQuery('#wp-link-url').prop('value'));
    } else if (value === "dialog") {
        urlCheckbox.removeClass('hidden');
        urlField.removeClass('hidden');
        pageList.addClass('hidden');
        emailField.addClass('hidden');
        emailSubjectField.addClass('hidden');
        phoneField.addClass('hidden');
        fileList.addClass('hidden');
        list.addClass('hidden');
        dialogList.removeClass('hidden');
        searchField.addClass('hidden');
        selectListItemByUrl(dialogList, jQuery('#wp-link-url').prop('value'));
    } else if (value === "file") {
        urlCheckbox.removeClass('hidden');
        urlField.removeClass('hidden');
        pageList.addClass('hidden');
        emailField.addClass('hidden');
        emailSubjectField.addClass('hidden');
        phoneField.addClass('hidden');
        list.addClass('hidden');
        dialogList.addClass('hidden');
        searchField.addClass('hidden');
        fileList.removeClass('hidden');
        selectListItemByUrl(fileList, jQuery('#wp-link-url').prop('value'));
    } else if (value === "phone") {
        var phoneVal = urlField.find('input').val().indexOf('tel:') === 0 ? urlField.find('input').val() : phoneField.find('input').val();
        phoneField.find('input').val(phoneVal.replace('tel:', ''));
        urlCheckbox.addClass('hidden');
        urlField.addClass('hidden');
        pageList.addClass('hidden').css({"display": "none"});
        emailField.addClass('hidden');
        emailSubjectField.addClass('hidden');
        phoneField.removeClass('hidden');
        list.addClass('hidden');
        searchField.addClass('hidden');
        fileList.addClass('hidden');
        dialogList.addClass('hidden');
    } else if (value === "email") {
        var emailVal = urlField.find('input').val().indexOf('mailto:') === 0 ? urlField.find('input').val() : emailField.find('input').val();
        var emailParts = emailVal.replace('mailto:', '').split('?subject=');
        if (emailParts.length) {
            emailField.find('input').val(emailParts[0]);
            emailSubjectField.find('input').val(emailParts[1] || emailSubjectField.find('input').val());
        }
        urlCheckbox.addClass('hidden');
        urlField.addClass('hidden');
        pageList.addClass('hidden').css({"display": "none"});
        emailField.removeClass('hidden');
        emailSubjectField.removeClass('hidden');
        phoneField.addClass('hidden');
        list.addClass('hidden');
        searchField.addClass('hidden');
        fileList.addClass('hidden');
        dialogList.addClass('hidden');
    } else {
        urlCheckbox.removeClass('hidden');
        urlField.removeClass('hidden');
        pageList.removeClass('hidden').css({"display": "block"});
        emailField.addClass('hidden');
        emailSubjectField.addClass('hidden');
        phoneField.addClass('hidden');
        fileList.addClass('hidden');
        dialogList.addClass('hidden');
        list.addClass('hidden');
        searchField.removeClass('hidden');
    }
}

function markAnchorByUrl(dialog, data) {
    var linkType = data.linkType || '';
    if (linkType === 'section') {
        dialog.find('.anchor-link input[value=section]').click();
    } else if (linkType === 'phone') {
        dialog.find('.anchor-link input[value=phone]').click();
    } else if (linkType === 'email') {
        dialog.find('.anchor-link input[value=email]').click();
    } else if (linkType === 'file') {
        dialog.find('.anchor-link input[value=file]').click();
    } else if (linkType === 'dialog') {
        dialog.find('.anchor-link input[value=dialog]').click();
    } else {
        dialog.find('.anchor-link input[value=page]').click();
    }
}

function addAnchorsToLinkDialog(dialog, data) {
    if (!data || !data.l || !data.l.anchorLink || !data.l.phoneLink || !data.l.emailLink || !data.l.fileLink || !data.l.dialogLink) {
        return;
    }
    let pagesNotice = dialog.find('.query-notice-default');
    if (pagesNotice.find('.added-notice').length == 0) {
        pagesNotice.html('<b class="added-notice">You can link only to published pages.</b><br>' + pagesNotice.html());
    }
    jQuery('#wp-link-wrap').css({"width": "650px"});
    jQuery('#link-options').css({"width": "74%", "float": "left"});
    dialog.find('#wplink-enter-url').css({"display": "none"});
    dialog.find('.query-results').css({"clear": "both"});
    dialog.find('.link-search-wrapper').css({"float": "left", "width": "63%"});
    dialog.find('#link-options').after(
        '<div class="anchor-link" style="float: left; width: 25%; margin-top: 12px;"><label>\n<input type="radio" name="link-destination" value="page"> ' +
        data.l.pageLink +
        '</label><br><label><span></span>\n<input type="radio" name="link-destination" value="section"> ' +
        data.l.anchorLink +
        '</label><br><div class="file-upload-parent"><label style="float: left;"><span></span>\n<input type="radio" name="link-destination" value="file"> ' +
        data.l.fileLink +
        '</label><div style="float: left;"><input style="display: none" type="file" name="file" id="nicepage-file-field" /><a id="np-upload-file" href="javascript:void(0);" style="padding-left: 5px; font-size: 13px; line-height: 1.4em; margin-top: 5px; box-shadow: none!important;">Upload</a>' +
        '</div><br></div><label><span></span>\n<input type="radio" name="link-destination" value="phone"> ' +
        data.l.phoneLink +
        '</label><br><label><span></span>\n<input type="radio" name="link-destination" value="email"> ' +
        data.l.emailLink +
        '</label><br><div class="dialog-container"><label><span></span>\n<input type="radio" name="link-destination" value="dialog"> ' +
        data.l.dialogLink +
        '</label></div></div>'
    );
    dialog.find('#search-panel').append(
        '<div id="anchor-links-list" class="query-results hidden" tabindex="0"><ul></ul>' +
        '<div class="river-waiting"><span class="spinner"></span></div></div>' +
        '<div id="dialog-links-list" class="query-results hidden" tabindex="0"><ul></ul>' +
        '<div class="river-waiting"><span class="spinner"></span></div></div>' +
        '<div id="file-links-list" class="query-results hidden" tabindex="0">' +
        '<ul></ul>' +
        '<div class="river-waiting"><span class="spinner"></span></div></div>'
    );
    addFileLinks(dialog.find('#file-links-list'), window.phpVars.mediaFiles.data);
    dialog.find('#anchor-links-list').on('click', 'li', handleAnchorListItemClick);
    dialog.find('#file-links-list').on('click', 'li', handleAnchorListItemClick);
    dialog.find('#dialog-links-list').on('click', 'li', handleAnchorListItemClick);
    dialog.find('.anchor-link input').not('#nicepage-file-field').on('change', handleLinkCheckboxChange);
    addItemLinks(dialog.find('#anchor-links-list'), data.anchorsList, 'Section');
    addItemLinks(dialog.find('#dialog-links-list'), data.dialogList, 'Modal Popup');
    markAnchorByUrl(dialog, data);
    if (window.dataForDialog.isMenu) {
        jQuery('.file-upload-parent, .dialog-container').addClass('hidden');
    }
    jQuery('#wp-link-text').parent().removeClass('hidden');
    if (!window.dataForDialog.caption) {
        jQuery('#wp-link-text').parent().addClass('hidden');
    }
    openEditLinkDialog();
}

function cleanupLinkDialog(dialog) {
    dialog.find('.anchor-link input').not('#nicepage-file-field').off('change', handleLinkCheckboxChange);
    dialog.find('#anchor-links-list').off('click', 'li', handleAnchorListItemClick);
    dialog.find('.anchor-link, #anchor-links-list').remove();

    dialog.find('#file-links-list').off('click', 'li', handleAnchorListItemClick);
    dialog.find('#file-links-list').remove();

    dialog.find('#dialog-links-list').off('click', 'li', handleAnchorListItemClick);
    dialog.find('#dialog-links-list').remove();

    dialog.find('.link-phone-number').remove();
    dialog.find('.link-email').remove();
    dialog.find('.link-email-subject').remove();
}

function postMessageListener(event) {
    if (event.origin !== location.origin) {
        return;
    }
    var data;
    try {
        data = JSON.parse(event.data);
    } catch (e) {
    }
    if (!data) {
        return;
    }
    window.dataForDialog = data.data;
    var childWindow = jQuery('#nicepage-editor-frame')[0].contentWindow;

    if (data.action === 'close') {
        closeEditor(data);
    } else if (data.action === 'editLinkDialogOpen') {
        wpLink.open();
        jQuery('#wplink-enter-url').before(jQuery('.wp-link-text-field'));
        jQuery('#wplink-link-existing-content').remove();
        jQuery('.wp-link-text-field label span').html('Label');

        jQuery('#wp-link-target').prop('checked', !!data.data.blank);
        jQuery('#wp-link-url').prop('value', data.data.url);
        jQuery('#wp-link-text').prop('value', data.data.value);
        jQuery('#wp-link .wp-link-text-field').after(
            '<div class="link-phone-number hidden"><label><span>Phone</span><input style="margin-left: 4px;" id="wp-link-phone" type="text" aria-describedby="wplink-enter-phone"></label></div>' +
            '<div class="link-email hidden"><label><span>Email</span><input style="margin-left: 4px;" id="wp-link-email" type="text" aria-describedby="wplink-enter-email"></label></div>' +
            '<div class="link-email-subject hidden"><label><span>Subject</span><input style="margin-left: 4px;" id="wp-link-email-subject" type="text" aria-describedby="wplink-enter-email-subject"></label></div>'
        );

        addAnchorsToLinkDialog(jQuery('#wp-link'), data.data);

        var wpLinkUpdate = wpLink.update;
        wpLink.update = function () {

            var data = {};

            var linkType = jQuery('input[name="link-destination"][type=radio]:checked').val();
            var url = jQuery('#wp-link-url'),
                email = jQuery('#wp-link-email'),
                subject = jQuery('#wp-link-email-subject'),
                subjectVal = '';
            if (linkType == 'email') {
                var emailValue = jQuery('#wp-link-email').val();
                var valid = /^[\w-\.]+@[\w-.]+$/i.test(emailValue);
                if (!valid) {
                    alert('Email is invalid');
                    return;
                }
                if (subject && subject.val() !== '') {
                    subjectVal = '?subject=' + subject.val();
                }
                url.val('mailto:' + email.val() + subjectVal);
            } else if (linkType == 'phone') {
                var phoneValue = jQuery('#wp-link-phone').val();
                var valid = /[^\d\s\+\-\(\)]/.test(phoneValue);
                if (valid) {
                    alert('Phone is invalid');
                    return;
                }
                url.val('tel:' + phoneValue);
            } else if (linkType == 'file' || linkType == 'dialog') {
                data.destination = linkType;
            }

            var attrs = wpLink.getAttrs();
            var $hrefDom = jQuery('#wp-link').find('.selected [value="' + attrs.href + '"]').closest('.selected');
            var newValue = jQuery('#wp-link-text').prop('value');
            var value = (newValue !== '') ? newValue : $hrefDom.find('.item-title').text();
            if (dataBridgeData && dataBridgeData.site && dataBridgeData.site.items) {
                dataBridgeData.site.items.forEach(function (item) {
                    if (item.publicUrl && item.publicUrl === attrs.href) {
                        return attrs.pageId = item.id;
                    }
                });
            }

            data.url = attrs.href;
            data.blank = !!attrs.target;
            data.value = value;

            if (attrs.pageId) {
                data.pageId = attrs.pageId;
            }

            childWindow.postMessage(JSON.stringify({
                action: 'editLinkDialogClose',
                data: data
            }), window.location.origin);
            wpLink.update = wpLinkUpdate;
            wpLink.close();
        };
        jQuery('body').on('click', '#wp-link .query-results ul li', function () {
            var oldValue = (jQuery('#wp-link-text').prop('value') || '').trim();
            var defaultContentList = [].concat(window.dataBridgeData && window.dataBridgeData.site && window.dataBridgeData.site.items && window.dataBridgeData.site.items.map(function (el) {
                return el.title;
            }) || [], window.dataForDialog && window.dataForDialog.defaultContentList || []);
            if (!oldValue || defaultContentList.includes(oldValue)) {
                jQuery('#wp-link-text').prop('value', jQuery(this).find('.item-title').text());
            }
        });

        jQuery(document).one('wplink-close', function () {
            cleanupLinkDialog(jQuery('#wp-link'));
            childWindow.postMessage(JSON.stringify({action: 'editLinkDialogClose'}), window.location.origin);
        });
    }
}

function waitFor(selector, callback) {
    var el = jQuery(selector);

    if (el.length) {
        callback(el);
        return;
    } else {
        setTimeout(function () {
            waitFor(selector, callback);
        }, 500);
    }
}