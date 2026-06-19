import React from 'react';
import {useThemeConfig} from '@docusaurus/theme-common';
import {useNavbarSecondaryMenu} from '@docusaurus/theme-common/internal';
import Translate from '@docusaurus/Translate';

function SecondaryMenuBackButton(props) {
  return (
    <button {...props} type="button" className="clean-btn navbar-sidebar__back">
      <Translate
        id="theme.navbar.mobileSidebarSecondaryMenu.backButtonLabel"
        description="The label of the back button to return to main menu, inside the mobile navbar sidebar secondary menu">
        ← Back to main menu
      </Translate>
    </button>
  );
}

function shouldHideBackButton(items) {
  return items.length === 0 || (items.length === 1 && items[0].type === 'docSidebar');
}

export default function NavbarMobileSidebarSecondaryMenu() {
  const items = useThemeConfig().navbar.items ?? [];
  const secondaryMenu = useNavbarSecondaryMenu();

  return (
    <>
      {!shouldHideBackButton(items) && (
        <SecondaryMenuBackButton onClick={() => secondaryMenu.hide()} />
      )}
      {secondaryMenu.content}
    </>
  );
}
