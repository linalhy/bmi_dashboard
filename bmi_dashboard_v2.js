importScripts("https://cdn.jsdelivr.net/pyodide/v0.22.1/full/pyodide.js");

function sendPatch(patch, buffers, msg_id) {
  self.postMessage({
    type: 'patch',
    patch: patch,
    buffers: buffers
  })
}

async function startApplication() {
  console.log("Loading pyodide!");
  self.postMessage({type: 'status', msg: 'Loading pyodide'})
  self.pyodide = await loadPyodide();
  self.pyodide.globals.set("sendPatch", sendPatch);
  console.log("Loaded!");
  await self.pyodide.loadPackage("micropip");
  const env_spec = ['https://cdn.holoviz.org/panel/0.14.4/dist/wheels/bokeh-2.4.3-py3-none-any.whl', 'https://cdn.holoviz.org/panel/0.14.4/dist/wheels/panel-0.14.4-py3-none-any.whl', 'pyodide-http==0.1.0', 'holoviews>=1.15.4', 'hvplot', 'numpy', 'pandas']
  for (const pkg of env_spec) {
    let pkg_name;
    if (pkg.endsWith('.whl')) {
      pkg_name = pkg.split('/').slice(-1)[0].split('-')[0]
    } else {
      pkg_name = pkg
    }
    self.postMessage({type: 'status', msg: `Installing ${pkg_name}`})
    try {
      await self.pyodide.runPythonAsync(`
        import micropip
        await micropip.install('${pkg}');
      `);
    } catch(e) {
      console.log(e)
      self.postMessage({
	type: 'status',
	msg: `Error while installing ${pkg_name}`
      });
    }
  }
  console.log("Packages loaded!");
  self.postMessage({type: 'status', msg: 'Executing code'})
  const code = `
  
import asyncio

from panel.io.pyodide import init_doc, write_doc

init_doc()

import pandas as pd
import numpy as np
import panel as pn
pn.extension('tabulator')
import hvplot.pandas

dataset_mean = pd.read_csv("D:\lina_lau\C339_datafundamentals\data_analysis_project\datasets\dataset_mean.csv")
dataset_under = pd.read_csv("D:\lina_lau\C339_datafundamentals\data_analysis_project\datasets\dataset_under.csv")
dataset_over = pd.read_csv("D:\lina_lau\C339_datafundamentals\data_analysis_project\datasets\dataset_over.csv")

# Make dataframe pipeline interactive
idf_mean = dataset_mean.interactive()
idf_over = dataset_over.interactive()
idf_under = dataset_under.interactive()

# Defining panel widgets: the sex dropdown menu
#year_slider = pn.widgets.IntSlider(name = 'Year slider', start = 1975, end = 2016, value = 1975)
sex_menu = pn.widgets.Select(options = ['BothSexes', 'Female', 'Male'], name = 'Sex')

# Defining Panel widgets: radio buttons for mean BMI in the pooled population
yaxis_prevalence = pn.widgets.RadioButtonGroup(
    name = 'Y axis',
    options = ['Prevalence'],
    button_type = 'success'
)

income_group = ['HighIncome', 'LowerIncome', 'LowerMiddleIncome', 'UpperMiddleIncome']

# Connecting the widgets to the dataset_mean pipeline
bmi_all_pipeline = (
    idf_mean[
        #(idf_mean.TimeDim <= year_slider) &
        (idf_mean.Sex == sex_menu) & 
        (idf_mean.WorldBankIncomeGroup.isin(income_group))
    ]
    .groupby(['WorldBankIncomeGroup', 'TimeDim'])[yaxis_prevalence].mean()
    .to_frame()
    .reset_index()
    .sort_values(by = 'TimeDim')
    .reset_index(drop = True)
)

# Creating a chart using the data pipeline
bmi_all_plot = bmi_all_pipeline.hvplot(x = 'TimeDim', 
                                       by = 'WorldBankIncomeGroup', 
                                       y = yaxis_prevalence, 
                                       xlabel = "Years",
                                       ylabel = "Body Mass Index (kg/m^2)",
                                       line_width = 2, 
                                       title = 'Mean BMI of adults by country income')

# Connecting the widgets to the dataset_over (overweight adults) pipeline
bmi_over_adult_pipeline = (
    idf_over[
        #(idf_over.TimeDim <= year_slider) & 
        (idf_over.Sex == sex_menu) & 
        (idf_over.WorldBankIncomeGroup.isin(income_group))
    ]
    .groupby(['WorldBankIncomeGroup', 'TimeDim'])[yaxis_prevalence].mean()
    .to_frame()
    .reset_index()
    .sort_values(by = 'TimeDim')
    .reset_index(drop = True)
)

# Creating a chart for overweight adults
bmi_over_adult_plot = bmi_over_adult_pipeline.hvplot(x = 'TimeDim', 
                                       by = 'WorldBankIncomeGroup', 
                                       y = yaxis_prevalence, 
                                       xlabel = "Years",
                                       ylabel = "Prevalence (%)",
                                       line_width = 2, 
                                       title = 'Age-standardised prevalence of overweight adults (BMI >30 kg/m2) by country income', 
                                       width = 800)

# Connecting the widgets to the under_adult (underweight adults) pipeline
bmi_under_adult_pipeline = (
    idf_under[
        #(idf_under.TimeDim <= year_slider) & 
        (idf_under.Sex == sex_menu) & 
        (idf_under.WorldBankIncomeGroup.isin(income_group))
    ]
    .groupby(['WorldBankIncomeGroup', 'TimeDim'])[yaxis_prevalence].mean()
    .to_frame()
    .reset_index()
    .sort_values(by = 'TimeDim')
    .reset_index(drop = True)
)


# Creating a chart for underweight adults
bmi_under_adult_plot = bmi_under_adult_pipeline.hvplot(x = 'TimeDim', 
                                       by = 'WorldBankIncomeGroup', 
                                       y = yaxis_prevalence, 
                                       xlabel = "Years",
                                       ylabel = "Prevalence (%)",
                                       line_width = 2, 
                                       title = 'Age-standardised prevalence of underweight adults (BMI <18 kg/m2) by country income', 
                                       width = 800, height = 400)



# Creating the dashboard

template = pn.template.FastListTemplate(
    title = 'Global Obesity Prevalence',
    sidebar = [pn.pane.Markdown("##Global prevalence of overweight and underweight people, by sex and country income (according to World Bank Classification)"),
              pn.pane.Markdown("#### Worldwide obesity has approximately tripled since 1975."),
              pn.pane.Markdown("#### In 2016, more than 1.9 bilion adults (>17 years and older), were overweight. Of these, >650 milion were obese."),
              pn.pane.Markdown("#### Most of the world's population live in countries where overweight and obesity kills more people than underweight."),
              pn.pane.JPG('https://c.ndtvimg.com/2020-06/dra42d7g_junk-food-_625x300_30_June_20.jpg', sizing_mode = 'scale_both'),
              pn.pane.Markdown("##Settings"),
              #year_slider,
              sex_menu, 
              pn.pane.Markdown(" Data source: World Health Organisation (2023)")],
             
    main = [pn.Row(pn.Column(yaxis_prevalence, bmi_all_plot.panel(width = 800, height = 300), margin = (0, 25))),
            pn.Row(pn.Column(yaxis_prevalence, bmi_over_adult_plot.panel(width = 800, height = 300), margin = (0, 25))),
            pn.Row(pn.Column(yaxis_prevalence, bmi_under_adult_plot.panel(width = 800, height = 300), margin = (0, 25)))],
    accent_base_color = "#88d8b0",
    header_base_color = "#88d8b0",
)
#template.show(port = 8080) # Launches local server
template.servable()




await write_doc()
  `

  try {
    const [docs_json, render_items, root_ids] = await self.pyodide.runPythonAsync(code)
    self.postMessage({
      type: 'render',
      docs_json: docs_json,
      render_items: render_items,
      root_ids: root_ids
    })
  } catch(e) {
    const traceback = `${e}`
    const tblines = traceback.split('\n')
    self.postMessage({
      type: 'status',
      msg: tblines[tblines.length-2]
    });
    throw e
  }
}

self.onmessage = async (event) => {
  const msg = event.data
  if (msg.type === 'rendered') {
    self.pyodide.runPythonAsync(`
    from panel.io.state import state
    from panel.io.pyodide import _link_docs_worker

    _link_docs_worker(state.curdoc, sendPatch, setter='js')
    `)
  } else if (msg.type === 'patch') {
    self.pyodide.runPythonAsync(`
    import json

    state.curdoc.apply_json_patch(json.loads('${msg.patch}'), setter='js')
    `)
    self.postMessage({type: 'idle'})
  } else if (msg.type === 'location') {
    self.pyodide.runPythonAsync(`
    import json
    from panel.io.state import state
    from panel.util import edit_readonly
    if state.location:
        loc_data = json.loads("""${msg.location}""")
        with edit_readonly(state.location):
            state.location.param.update({
                k: v for k, v in loc_data.items() if k in state.location.param
            })
    `)
  }
}

startApplication()