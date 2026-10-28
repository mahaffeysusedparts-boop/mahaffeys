import { test, expect } from '@playwright/test';

for (const viewport of [{width:1280,height:900},{width:768,height:1024}]) {
  test(`Scale evidence assignments and real previews fit ${viewport.width}px`,async ({page},testInfo) => {
    await page.setViewportSize(viewport);
    const user = {id:'synthetic-manager',username:'synthetic-manager',fullName:'Synthetic Manager',role:'yard_manager',status:'approved'};
    const scales = [{id:'synthetic-truck',name:'Test Truck Scale',evidenceCameras:{} as Record<string,string>}];
    const cameras = [{id:'load-camera',name:'Load Camera'},{id:'truck-camera',name:'Truck Camera'}];
    const state = {mahaffeys_tickets:[],mahaffeys_settings:{yardName:'Synthetic Yard',scales,currentScaleId:scales[0].id,operatorName:user.fullName}};
    const snapshots: string[] = [];
    const writes: Record<string,any>[] = [];
    await page.route('**://192.168.*/**',route => route.abort());
    await page.route('**/api/**',async route => {
      const path = new URL(route.request().url()).pathname;
      let response: unknown = {ok:true};
      if (path === '/api/auth/status') response = {user,hasAdmin:true};
      else if (path === '/api/state') response = {state};
      else if (path === '/api/users') response = {users:[]};
      else if (path === '/api/printers') response = [];
      else if (path === '/api/scale/status') response = {connected:false,weight:0,unit:'LBS',isStable:false,isZero:true,registry:[]};
      else if (path === '/api/scale/evidence-config') {
        if (route.request().method() === 'POST') {
          const input = route.request().postDataJSON();writes.push(input);
          scales[0].evidenceCameras = input.mappings;
          response = {scaleId:scales[0].id,mappings:input.mappings};
        } else response = {scales,cameras};
      } else if (/\/api\/cameras\/[^/]+\/snapshot$/.test(path)) {
        snapshots.push(path);
        await route.fulfill({contentType:'image/svg+xml',headers:{'X-Snapshot-Captured-At':'2026-10-28T12:00:00.000Z','Cache-Control':'no-store, private'},body:'<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90"><rect width="160" height="90" fill="blue"/></svg>'});return;
      }
      await route.fulfill({json:response});
    });
    await page.goto('/intake');
    await page.getByRole('button',{name:'Scale offline. Open scale configuration',exact:true}).click();
    const dialog = page.getByRole('dialog');
    const section = dialog.getByRole('region',{name:'Scale Evidence Cameras'});
    await expect(section.getByText(/Unmapped: Load, Truck \/ Vehicle, License Plate/)).toBeVisible();
    for (const [label,camera] of [['Load','Load Camera'],['Truck / Vehicle','Truck Camera'],['License Plate','Truck Camera']]) {
      await section.getByRole('combobox',{name:label,exact:true}).click();
      await page.getByRole('option',{name:camera,exact:true}).click();
    }
    await expect(section.getByText('Truck Camera · Truck / Vehicle + License Plate (shared view)',{exact:true})).toBeVisible();
    await expect(section.getByRole('button',{name:'Test Truck Camera',exact:true})).toHaveCount(1);
    await section.getByRole('button',{name:'Test Truck Camera',exact:true}).click();
    await expect(section.getByRole('img',{name:'Scale camera snapshot preview'})).toHaveAttribute('src',/^blob:/);
    await expect(section.getByText(/Test only — not ticket evidence/)).toBeVisible();
    expect(snapshots).toEqual(['/api/cameras/truck-camera/snapshot']);
    await section.getByRole('button',{name:'Save camera assignments',exact:true}).click();
    await expect(page.getByText('Scale evidence cameras saved',{exact:true})).toBeVisible();
    expect(writes).toEqual([{scaleId:'synthetic-truck',mappings:{load:'load-camera',vehicle:'truck-camera',plate:'truck-camera'},expectedMappings:{}}]);
    const box = await dialog.boundingBox();
    expect(box!.width).toBeLessThanOrEqual(viewport.width);
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await dialog.screenshot({path:testInfo.outputPath(`scale-camera-settings-${viewport.width}.png`)});
    await dialog.getByRole('button',{name:'Done',exact:true}).click();
    await page.getByRole('button',{name:'Scale offline. Open scale configuration',exact:true}).click();
    await expect(page.getByRole('combobox',{name:'License Plate',exact:true})).toContainText('Truck Camera');
  });
}
